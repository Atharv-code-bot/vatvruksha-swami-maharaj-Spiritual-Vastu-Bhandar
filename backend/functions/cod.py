"""Cash-on-delivery callable flow."""
import hashlib
import re
from datetime import datetime, timezone

from firebase_admin import firestore
from firebase_functions import https_fn

from email_service import send_order_notifications

from order_service import (
    COD_FEE_PAISE,
    SHIPPING_FEE_PAISE,
    MAX_ORDER_LINES,
    db,
    _create_order_transaction,
    _invalid,
    _order_response,
    _required_text,
    _validate_items,
    _validate_shipping_address,
)

@https_fn.on_call(secrets=["RESEND_API_KEY"])
def createCodOrder(req: https_fn.CallableRequest):
    """Create a COD order with server-side pricing and atomic stock deduction."""

    if req.auth is None:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            "Sign in before placing an order.",
        )

    token = req.auth.token
    uid = req.auth.uid

    # Checkout requires a verified email. UID is never taken from request data.
    email = token.get("email")
    if (
        token.get("email_verified") is not True
        or not isinstance(email, str)
        or not email.strip()
    ):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Verify your email before placing an order.",
        )

    data = req.data
    if not isinstance(data, dict):
        _invalid("Request data must be an object.")

    # Reject client-provided prices, totals, userId, payment status, and
    # other unsupported fields instead of accidentally trusting them.
    if set(data.keys()) != {"requestId", "items", "shippingAddress"}:
        _invalid(
            "Request must contain only requestId, items and shippingAddress."
        )

    request_id = _required_text(data["requestId"], "requestId")
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", request_id):
        _invalid("requestId must contain 8-128 safe characters.")

    normalized_items = _validate_items(data["items"])
    shipping_address = _validate_shipping_address(data["shippingAddress"])

    request_key_hash = hashlib.sha256(request_id.encode("utf-8")).hexdigest()

    # Deterministic order ID makes retries with the same key idempotent.
    order_digest = hashlib.sha256(
        f"{uid}:{request_id}".encode("utf-8")
    ).hexdigest()[:20].upper()
    order_number = f"SVB-{order_digest}"

    order_ref = db.collection("orders").document(order_number)
    profile_ref = db.collection("users").document(uid)
    now = datetime.now(timezone.utc)

    try:
        transaction = db.transaction(max_attempts=5)

        transactional_create = firestore.transactional(
            _create_order_transaction
        )

        result = transactional_create(
            transaction,
            uid,
            email.strip(),
            request_key_hash,
            order_ref,
            profile_ref,
            normalized_items,
            shipping_address,
            now,
            payment_method="cod",
            initial_status="confirmed",
            payment_status="pending",
        )

        # Only send on the first successful creation, never on an idempotent retry.
        if not result.get("idempotent"):
            created_snapshot = order_ref.get()
            if created_snapshot.exists:
                order_data = created_snapshot.to_dict()
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
                        "COD email notification status update failed: "
                        f"{type(notification_error).__name__}"
                    )
        return result

    except https_fn.HttpsError:
        raise
    except Exception as exc:
        # Log detailed exceptions on the server, not to the customer.
        print(f"createCodOrder failed: {type(exc).__name__}: {exc}")
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INTERNAL,
            "Unable to place the order. Please retry using the same requestId.",
        ) from exc
