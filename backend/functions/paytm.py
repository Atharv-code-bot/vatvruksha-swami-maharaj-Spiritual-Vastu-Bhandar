"""Paytm initiation, status verification, and reservation reconciliation."""
import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal


import requests
from paytmchecksum import PaytmChecksum
from firebase_admin import firestore
from firebase_functions import https_fn, scheduler_fn

from order_service import db, _create_order_transaction, _invalid, _required_text, _validate_items, _validate_shipping_address
from email_service import send_order_notifications

# Production-oriented fallback defaults (10 minutes). Local emulator tests
# override these through .env.local (e.g. reservation=2, schedule=2).
# Never commit merchant credentials.
PAYTM_RESERVATION_MINUTES = max(1, int(os.environ.get("PAYTM_RESERVATION_MINUTES", "10")))
PAYTM_EXPIRY_SCHEDULE_MINUTES = max(1, int(os.environ.get("PAYTM_EXPIRY_SCHEDULE_MINUTES", "10")))
PAYTM_UNRESOLVED_PAYMENT_MINUTES = max(1, int(os.environ.get("PAYTM_UNRESOLVED_PAYMENT_MINUTES", "180")))
PAYTM_HTTP_TIMEOUT_SECONDS = 15

def _paytm_config() -> dict:
    """Load Paytm configuration without ever logging secret values."""
    environment = os.environ.get("PAYTM_ENVIRONMENT", "staging").strip().lower()
    mid = os.environ.get("PAYTM_MID", "").strip()
    merchant_key = os.environ.get("PAYTM_MERCHANT_KEY", "").strip()
    website_name = os.environ.get(
        "PAYTM_WEBSITE_NAME", "WEBSTAGING" if environment == "staging" else "DEFAULT"
    ).strip()

    if environment not in {"staging", "production"}:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "PAYTM_ENVIRONMENT must be staging or production.",
        )
    if not mid or not merchant_key or not website_name:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Paytm is not configured. Check the backend environment variables.",
        )

    base_url = (
    "https://securestage.paytmpayments.com"
    if environment == "staging"
    else "https://secure.paytmpayments.com"
    )
    return {
        "environment": environment,
        "mid": mid,
        "merchant_key": merchant_key,
        "website_name": website_name,
        "base_url": base_url,
    }


def _paise_to_rupees(amount_paise: int) -> str:
    return format(Decimal(amount_paise) / Decimal(100), ".2f")


def _paytm_post_json(url: str, payload: dict) -> dict:
    """POST JSON to Paytm and reject malformed/non-JSON responses safely."""
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=PAYTM_HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict):
            raise ValueError("Paytm returned a non-object response")
        return body
    except (requests.RequestException, ValueError) as exc:
        # Do not include gateway response bodies or credentials in client errors.
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAVAILABLE,
            "Unable to contact Paytm right now. Your order may still be pending; check its status before retrying.",
        ) from exc


def _paytm_initiate_transaction(order_id: str, order: dict) -> str:
    """Initiate Paytm payment and return the server-issued transaction token."""
    config = _paytm_config()
    total_paise = order["totals"]["total"]
    body = {
        "requestType": "Payment",
        "mid": config["mid"],
        "websiteName": config["website_name"],
        "orderId": order_id,
        "txnAmount": {"value": _paise_to_rupees(total_paise), "currency": "INR"},
        "userInfo": {
            "custId": order["userId"],
            "email": order["customer"]["email"],
            "mobile": order["customer"]["mobile"],
            "firstName": order["customer"]["name"][:50],
        },
    }
    body_json = json.dumps(body, ensure_ascii=False)
    signature = PaytmChecksum.generateSignature(body_json, config["merchant_key"])
    response = _paytm_post_json(
        f"{config['base_url']}/theia/api/v1/initiateTransaction"
        f"?mid={config['mid']}&orderId={order_id}",
        {"body": body, "head": {"signature": signature}},
    )
    response_body = response.get("body", {})
    result_info = response_body.get("resultInfo", {}) if isinstance(response_body, dict) else {}
    txn_token = response_body.get("txnToken") if isinstance(response_body, dict) else None
    if result_info.get("resultStatus") != "S" or not isinstance(txn_token, str) or not txn_token:
        # Keep the order pending; a scheduled status reconciliation handles ambiguous outcomes.
        print(
            f"Paytm initiation rejected for order {order_id}: "
            f"code={result_info.get('resultCode', 'unknown')}, "
            f"message={result_info.get('resultMsg', 'unknown')}")
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAVAILABLE,
            "Paytm could not start this payment. Please check order status before trying again.",
        )
    return txn_token


def _extract_raw_json_member(raw_json: str, member_name: str) -> str | None:
    """Return a top-level JSON member's exact source text, without re-serializing it."""
    decoder = json.JSONDecoder()
    length = len(raw_json)
    index = 0

    def skip_whitespace(position: int) -> int:
        while position < length and raw_json[position].isspace():
            position += 1
        return position

    index = skip_whitespace(index)
    if index >= length or raw_json[index] != "{":
        return None
    index += 1

    while True:
        index = skip_whitespace(index)
        if index >= length or raw_json[index] == "}":
            return None
        try:
            key, key_end = decoder.raw_decode(raw_json, index)
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(key, str):
            return None
        index = skip_whitespace(key_end)
        if index >= length or raw_json[index] != ":":
            return None
        value_start = skip_whitespace(index + 1)
        try:
            value, value_end = decoder.raw_decode(raw_json, value_start)
        except (json.JSONDecodeError, TypeError):
            return None
        if key == member_name:
            return raw_json[value_start:value_end]
        index = skip_whitespace(value_end)
        if index < length and raw_json[index] == ",":
            index += 1
            continue
        if index < length and raw_json[index] == "}":
            return None
        return None


def _paytm_signature_candidates(response_body: dict, raw_body: str | None) -> list[str]:
    """Return the serializations of the response body that Paytm may have signed.

    Paytm's docs say the status response carries a signature, but not which exact
    byte layout it covers. Every candidate here is a serialization of the SAME
    parsed body, so a valid signature over any one of them still authenticates
    exactly this content; none can be forged without the merchant key.
    """
    candidates = [raw_body] if raw_body is not None else []
    for ensure_ascii in (False, True):
        candidates.append(json.dumps(response_body, separators=(",", ":"), ensure_ascii=ensure_ascii))
        candidates.append(json.dumps(response_body, ensure_ascii=ensure_ascii))
    return list(dict.fromkeys(candidates))


def _paytm_response_signature_valid(
    response_body: dict, raw_body: str | None, merchant_key: str, signature: object
) -> bool:
    """True only if Paytm's signature verifies under the merchant key."""
    if not isinstance(signature, str) or not signature:
        return False
    for candidate in _paytm_signature_candidates(response_body, raw_body):
        try:
            if PaytmChecksum.verifySignature(candidate, merchant_key, signature):
                return True
        except Exception:
            # Malformed signature or wrong key: decryption fails for every candidate.
            return False
    return False


def _paytm_fetch_status(order_id: str) -> dict:
    """Query Paytm and verify its signature against the exact response-body JSON."""
    config = _paytm_config()
    body = {"mid": config["mid"], "orderId": order_id}
    body_json = json.dumps(body, ensure_ascii=False)
    signature = PaytmChecksum.generateSignature(body_json, config["merchant_key"])
    payload = {"body": body, "head": {"signature": signature}}

    try:
        response = requests.post(
            f"{config['base_url']}/v3/order/status",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=PAYTM_HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        response_text = response.text
        response_data = response.json()
        if not isinstance(response_data, dict):
            raise ValueError("Paytm returned a non-object status response")
    except (requests.RequestException, ValueError) as exc:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAVAILABLE,
            "Unable to retrieve payment status from Paytm. The order remains unconfirmed until status can be verified.",
        ) from exc

    response_body = response_data.get("body")
    if not isinstance(response_body, dict):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAVAILABLE,
            "Paytm returned an invalid payment status response.",
        )

    response_head = response_data.get("head", {})
    response_signature = response_head.get("signature") if isinstance(response_head, dict) else None
    # Paytm signs the response body with the merchant key. The exact serialization
    # it signs is not documented, so try the exact wire text first, then canonical
    # serializations of the same parsed body (see _paytm_signature_candidates).
    raw_response_body = _extract_raw_json_member(response_text, "body")
    if not _paytm_response_signature_valid(
        response_body, raw_response_body, config["merchant_key"], response_signature
    ):
        # Safe diagnostics: never log the merchant key, signature, or customer data.
        # resultInfo comes from an UNAUTHENTICATED response and is for diagnosis only.
        result_info = response_body.get("resultInfo")
        result_info = result_info if isinstance(result_info, dict) else {}
        print(
            f"Paytm status signature verification failed for order {order_id}; "
            f"http_status={response.status_code}, "
            f"signature_present={bool(response_signature)}, "
            f"raw_body_found={raw_response_body is not None}, "
            f"head_fields={sorted(response_head) if isinstance(response_head, dict) else []}, "
            f"response_fields={sorted(response_data.keys())}, "
            f"result_status={str(result_info.get('resultStatus'))[:32]}, "
            f"result_code={str(result_info.get('resultCode'))[:16]}"
        )
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.DATA_LOSS,
            "Paytm payment status response could not be authenticated.",
        )
    return response_body


def _release_paytm_stock_transaction(
    transaction,
    order_ref,
    order_data: dict,
    now: datetime,
    *,
    delete_order: bool = False,
    target_status: str = "payment_failed",
) -> bool:
    """Restore reserved stock once and either delete or update the pending order."""
    if order_data.get("paymentMethod") != "paytm":
        return False
    if order_data.get("status") != "pending_payment" or order_data.get("stockReleasedAt"):
        return False
    if target_status not in {"payment_failed", "payment_review"}:
        raise ValueError("Unsupported stock-release target status")

    product_ids = sorted({item["productId"] for item in order_data.get("items", [])})
    product_refs = {pid: db.collection("products").document(pid) for pid in product_ids}
    snapshots = {pid: ref.get(transaction=transaction) for pid, ref in product_refs.items()}

    # All reads happen before any writes.
    increments = {}
    for item in order_data.get("items", []):
        pid = item["productId"]
        variant_id = item["variantId"]
        quantity = item["quantity"]
        if not snapshots[pid].exists:
            raise RuntimeError(f"Cannot release stock: product {pid} is missing")
        product = snapshots[pid].to_dict()
        variants = product.get("variants", {})
        variant = variants.get(variant_id) if isinstance(variants, dict) else None
        if not isinstance(variant, dict):
            raise RuntimeError(f"Cannot release stock: variant {variant_id} is missing")
        key = (pid, variant_id)
        increments[key] = increments.get(key, 0) + quantity

    for (pid, variant_id), quantity in increments.items():
        transaction.update(
            product_refs[pid],
            {f"variants.{variant_id}.stock": firestore.Increment(quantity), "updatedAt": now},
        )

    if delete_order:
        # Stock restoration and deletion happen atomically after a verified
        # NO_RECORD_FOUND response and an expired reservation.
        transaction.delete(order_ref)
    else:
        history = list(order_data.get("statusHistory", []))
        history.append({"status": target_status, "timestamp": now, "actor": {"type": "system"}})
        transaction.update(
            order_ref,
            {
                "status": target_status,
                "payment.status": "failed" if target_status == "payment_failed" else "review_required",
                "stockReleasedAt": now,
                "updatedAt": now,
                "statusHistory": history,
            },
        )
    return True


def _release_unresolved_order_if_due(order_id: str, now: datetime) -> bool:
    """Release stock and mark review once the unresolved window has elapsed."""
    order_ref = db.collection("orders").document(order_id)

    @firestore.transactional
    def apply(transaction):
        snap = order_ref.get(transaction=transaction)
        if not snap.exists:
            return False
        order = snap.to_dict()
        if order.get("status") != "pending_payment" or order.get("paymentMethod") != "paytm":
            return False
        reserved_until = order.get("reservedUntil")
        if not isinstance(reserved_until, datetime):
            return False
        unresolved_minutes = (now - reserved_until).total_seconds() / 60
        if unresolved_minutes < PAYTM_UNRESOLVED_PAYMENT_MINUTES:
            return False
        return _release_paytm_stock_transaction(
            transaction, order_ref, order, now, target_status="payment_review"
        )

    return apply(db.transaction(max_attempts=5))


def _finalize_paytm_status(order_id: str, paytm_status: dict) -> dict:
    """Apply a verified Paytm status to the matching Firestore order atomically."""
    order_ref = db.collection("orders").document(order_id)
    now = datetime.now(timezone.utc)
    result_info = paytm_status.get("resultInfo", {})
    result_status = result_info.get("resultStatus") if isinstance(result_info, dict) else None
    returned_order_id = paytm_status.get("orderId")
    txn_amount = paytm_status.get("txnAmount")
    txn_id = paytm_status.get("txnId")

    if returned_order_id != order_id:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.DATA_LOSS,
            "Paytm returned a status for a different order.",
        )

    @firestore.transactional
    def apply(transaction):
        snap = order_ref.get(transaction=transaction)
        if not snap.exists:
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Order not found.")
        order = snap.to_dict()
        if order.get("paymentMethod") != "paytm":
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "This is not a Paytm order.")

        expected_amount = _paise_to_rupees(order["totals"]["total"])
        if result_status == "TXN_SUCCESS" and str(txn_amount) != expected_amount:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.DATA_LOSS,
                "Paytm amount does not match the order total.",
            )
        if txn_amount is not None and str(txn_amount) != expected_amount:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.DATA_LOSS,
                "Paytm amount does not match the order total.",
            )

        current_status = order.get("status")
        payment_status = order.get("payment", {}).get("status")
        if payment_status == "paid":
            return {"ok": True, "orderId": order_id, "status": current_status, "paymentStatus": "paid"}

        reserved_until = order.get("reservedUntil")
        reservation_ended = isinstance(reserved_until, datetime) and reserved_until <= now

        if current_status == "payment_review":
            # Stock has already been released. A late success must not auto-fulfil.
            if result_status == "TXN_SUCCESS":
                history = list(order.get("statusHistory", []))
                history.append({"status": "paid_review_required", "timestamp": now, "actor": {"type": "system"}})
                transaction.update(
                    order_ref,
                    {
                        "status": "paid_review_required",
                        "payment.status": "paid",
                        "payment.transactionId": txn_id or "",
                        "payment.gateway": "paytm",
                        "payment.verifiedAt": now,
                        "updatedAt": now,
                        "statusHistory": history,
                    },
                )
                return {"ok": True, "orderId": order_id, "status": "paid_review_required", "paymentStatus": "paid"}

            if result_status == "TXN_FAILURE":
                history = list(order.get("statusHistory", []))
                history.append({"status": "payment_failed", "timestamp": now, "actor": {"type": "system"}})
                transaction.update(
                    order_ref,
                    {
                        "status": "payment_failed",
                        "payment.status": "failed",
                        "updatedAt": now,
                        "statusHistory": history,
                    },
                )
                return {"ok": True, "orderId": order_id, "status": "payment_failed", "paymentStatus": "failed"}

            if result_status == "NO_RECORD_FOUND" and reservation_ended:
                # Stock was released on entry to review; only delete the order now.
                transaction.delete(order_ref)
                return {"ok": True, "orderId": order_id, "status": "deleted", "paymentStatus": "no_record_found"}

            return {"ok": True, "orderId": order_id, "status": current_status, "paymentStatus": "review_required"}

        if current_status != "pending_payment":
            return {"ok": True, "orderId": order_id, "status": current_status, "paymentStatus": payment_status}

        if result_status == "TXN_SUCCESS":
            history = list(order.get("statusHistory", []))
            history.append({"status": "confirmed", "timestamp": now, "actor": {"type": "system"}})
            transaction.update(
                order_ref,
                {
                    "status": "confirmed",
                    "payment.status": "paid",
                    "payment.transactionId": txn_id or "",
                    "payment.gateway": "paytm",
                    "payment.verifiedAt": now,
                    "updatedAt": now,
                    "statusHistory": history,
                },
            )
            return {"ok": True, "orderId": order_id, "status": "confirmed", "paymentStatus": "paid", "justConfirmed": True}

        # Definitive failure retains the failed order and releases stock once.
        if result_status == "TXN_FAILURE":
            _release_paytm_stock_transaction(transaction, order_ref, order, now)
            return {"ok": True, "orderId": order_id, "status": "payment_failed", "paymentStatus": "failed"}

        # NO_RECORD_FOUND deletes only after the reservation expires.
        if result_status == "NO_RECORD_FOUND" and reservation_ended:
            _release_paytm_stock_transaction(transaction, order_ref, order, now, delete_order=True)
            return {"ok": True, "orderId": order_id, "status": "deleted", "paymentStatus": "no_record_found"}

        # PENDING/unknown responses remain pending until the configured window
        # after reservedUntil elapses. Then release stock once and retain for review.
        unresolved_minutes = (
            (now - reserved_until).total_seconds() / 60
            if isinstance(reserved_until, datetime) and reservation_ended
            else 0
        )
        if unresolved_minutes >= PAYTM_UNRESOLVED_PAYMENT_MINUTES:
            _release_paytm_stock_transaction(
                transaction, order_ref, order, now, target_status="payment_review"
            )
            return {"ok": True, "orderId": order_id, "status": "payment_review", "paymentStatus": "pending"}

        return {"ok": True, "orderId": order_id, "status": current_status, "paymentStatus": "pending"}

    return apply(db.transaction(max_attempts=5))


@https_fn.on_call(secrets=["PAYTM_MERCHANT_KEY"])
def createPaytmOrder(req: https_fn.CallableRequest):
    """Create a pending Paytm order, reserve stock, and return a transaction token."""
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in before placing an order.")

    token = req.auth.token
    uid = req.auth.uid
    email = token.get("email")
    if token.get("email_verified") is not True or not isinstance(email, str) or not email.strip():
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Verify your email before placing an order.",
        )

    data = req.data
    if not isinstance(data, dict) or set(data.keys()) != {"requestId", "items", "shippingAddress"}:
        _invalid("Request must contain only requestId, items and shippingAddress.")

    # Fail before reserving inventory if Paytm credentials/configuration are missing.
    _paytm_config()
    request_id = _required_text(data["requestId"], "requestId")
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", request_id):
        _invalid("requestId must contain 8-128 safe characters.")

    normalized_items = _validate_items(data["items"])
    shipping_address = _validate_shipping_address(data["shippingAddress"])
    request_key_hash = hashlib.sha256(request_id.encode("utf-8")).hexdigest()
    digest = hashlib.sha256(f"paytm:{uid}:{request_id}".encode("utf-8")).hexdigest()[:20].upper()
    order_number = f"SVBP{digest}"      
    order_ref = db.collection("orders").document(order_number)
    profile_ref = db.collection("users").document(uid)
    now = datetime.now(timezone.utc)
    reserved_until = now + timedelta(minutes=PAYTM_RESERVATION_MINUTES)

    try:
        transaction = db.transaction(max_attempts=5)
        create_transaction = firestore.transactional(_create_order_transaction)
        order_result = create_transaction(
            transaction,
            uid,
            email.strip(),
            request_key_hash,
            order_ref,
            profile_ref,
            normalized_items,
            shipping_address,
            now,
            payment_method="paytm",
            initial_status="pending_payment",
            payment_status="pending",
            reserved_until=reserved_until,
        )
        order_snapshot = order_ref.get()
        order_data = order_snapshot.to_dict()
        if order_data.get("status") != "pending_payment":
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                "This order is no longer awaiting payment. Create a new order to try again.",
            )
        txn_token = _paytm_initiate_transaction(order_number, order_data)
        return {
            **order_result,
            "status": "pending_payment",
            "payment": {
                "provider": "paytm",
                "mid": _paytm_config()["mid"],
                "txnToken": txn_token,
                "amount": _paise_to_rupees(order_data["totals"]["total"]),
                "environment": _paytm_config()["environment"],
                "reservedUntil": order_data.get("reservedUntil", reserved_until).isoformat(),
            },
        }
    except https_fn.HttpsError:
        raise
    except Exception as exc:
        print(f"createPaytmOrder failed: {type(exc).__name__}: {exc}")
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INTERNAL,
            "Unable to start Paytm checkout. Check the order status before retrying.",
        ) from exc


@https_fn.on_call(secrets=["PAYTM_MERCHANT_KEY", "RESEND_API_KEY"])
def verifyPaytmPayment(req: https_fn.CallableRequest):
    """Verify payment against Paytm's signed status API for the signed-in owner."""
    if req.auth is None:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in to verify payment.")
    data = req.data
    if not isinstance(data, dict) or set(data.keys()) != {"orderId"}:
        _invalid("Request must contain only orderId.")
    order_id = _required_text(data["orderId"], "orderId")
    if not re.fullmatch(r"(?:SVB-P-|SVBP)[A-F0-9]{20}", order_id):
        _invalid("Invalid Paytm orderId.")

    order_ref = db.collection("orders").document(order_id)
    snap = order_ref.get()
    if not snap.exists:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, "Order not found.")
    order = snap.to_dict()
    if order.get("userId") != req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED, "You cannot verify another customer's order.")
    if order.get("paymentMethod") != "paytm":
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "This is not a Paytm order.")
    if order.get("payment", {}).get("status") == "paid":
        return {"ok": True, "orderId": order_id, "status": order.get("status"), "paymentStatus": "paid"}

    status = _paytm_fetch_status(order_id)
    result = _finalize_paytm_status(order_id, status)
    if result.get("justConfirmed"):
        latest = order_ref.get()
        if latest.exists:
            order_data = latest.to_dict()
            notifications = send_order_notifications(order_data)
            try:
                order_ref.update({
                    "emailNotifications": {
                        "customerInitial": "sent" if notifications["customer"] else "failed",
                        "ownerInitial": "sent" if notifications["owner"] else "failed",
                        "attemptedAt": datetime.now(timezone.utc),
                    }
                })
            except Exception as notification_error:
                print(
                    "Paytm email notification status update failed: "
                    f"{type(notification_error).__name__}"
                )
        result.pop("justConfirmed", None)
    return result


@scheduler_fn.on_schedule(
    schedule=f"every {PAYTM_EXPIRY_SCHEDULE_MINUTES} minutes",
    timezone="Asia/Kolkata",
    secrets=["PAYTM_MERCHANT_KEY", "RESEND_API_KEY"],
)
def expirePendingPaytmOrders(event: scheduler_fn.ScheduledEvent):
    """Reconcile expired Paytm orders and release unresolved reservations after a configured window."""
    now = datetime.now(timezone.utc)
    print(
        "Paytm expiry scheduler started: "
        f"schedule_interval_minutes={PAYTM_EXPIRY_SCHEDULE_MINUTES}, "
        f"reservation_minutes={PAYTM_RESERVATION_MINUTES}, "
        f"unresolved_payment_minutes={PAYTM_UNRESOLVED_PAYMENT_MINUTES}"
    )

    # Only pending_payment orders are automatically reconciled. Once an order
    # enters payment_review, stock has been released and the owner handles it
    # manually; do not poll it again in subsequent scheduler cycles.
    query = (
        db.collection("orders")
        .where("paymentMethod", "==", "paytm")
        .where("status", "==", "pending_payment")
        .where("reservedUntil", "<=", now)
        .limit(100)
    )
    expired = list(query.stream())
    print(f"Paytm expiry scheduler found {len(expired)} expired order(s) to reconcile.")

    for snapshot in expired:
        try:
            print(f"Paytm expiry scheduler checking order {snapshot.id}.")
            status = _paytm_fetch_status(snapshot.id)
            result_info = status.get("resultInfo", {})
            if not isinstance(result_info, dict):
                result_info = {}
            print(
                f"Verified Paytm response for order {snapshot.id}: "
                f"resultStatus={str(result_info.get('resultStatus', 'unknown'))[:32]}, "
                f"resultCode={str(result_info.get('resultCode', 'unknown'))[:32]}, "
                f"resultMsg={str(result_info.get('resultMsg', 'unknown'))[:120]}, "
                f"orderId={str(status.get('orderId', 'unknown'))[:64]}"
            )
            result = _finalize_paytm_status(snapshot.id, status)
            if result.get("justConfirmed"):
                latest = db.collection("orders").document(snapshot.id).get()
                if latest.exists:
                    order_ref = db.collection("orders").document(snapshot.id)
                    notifications = send_order_notifications(latest.to_dict())
                    try:
                        order_ref.update({
                            "emailNotifications": {
                                "customerInitial": "sent" if notifications["customer"] else "failed",
                                "ownerInitial": "sent" if notifications["owner"] else "failed",
                                "attemptedAt": datetime.now(timezone.utc),
                            }
                        })
                    except Exception as notification_error:
                        print(
                            "Scheduled Paytm email status update failed: "
                            f"{type(notification_error).__name__}"
                        )
            print(
                f"Paytm expiry scheduler result for {snapshot.id}: "
                f"status={result.get('status')}, "
                f"paymentStatus={result.get('paymentStatus')}"
            )
        except Exception as exc:
            # A network/signature error is not proof of failure. If the unresolved
            # window has elapsed, release stock once but retain the order for review.
            print(
                f"Paytm expiry reconciliation deferred for {snapshot.id}: "
                f"{type(exc).__name__}"
            )
            try:
                released = _release_unresolved_order_if_due(snapshot.id, datetime.now(timezone.utc))
                if released:
                    print(
                        f"Paytm unresolved order moved to payment_review after "
                        f"{PAYTM_UNRESOLVED_PAYMENT_MINUTES} minute(s): {snapshot.id}"
                    )
            except Exception as release_exc:
                print(
                    f"Paytm unresolved stock release failed for {snapshot.id}: "
                    f"{type(release_exc).__name__}"
                )

