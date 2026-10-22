"""Shared Firestore setup, validation, and transactional order services."""
import re
from datetime import datetime
import os

from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn, options

initialize_app()
db = firestore.client()
options.set_global_options(region="asia-south1", max_instances=10)



SHIPPING_FEE_PAISE = int(os.environ.get("SHIPPING_FEE_PAISE", "0"))
COD_FEE_PAISE = int(os.environ.get("COD_FEE_PAISE", "0"))

MAX_ORDER_LINES = 50

def _invalid(message: str):
    raise https_fn.HttpsError(
        https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
        message,
    )


def _required_text(value, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _invalid(f"{field} must be a non-empty string.")
    return value.strip()


def _validate_shipping_address(value: object) -> dict:
    """Validate and copy the checkout address; never store arbitrary fields."""
    if not isinstance(value, dict):
        _invalid("shippingAddress must be an object.")

    required = (
        "fullName",
        "mobile",
        "addressLine1",
        "city",
        "state",
        "pincode",
    )
    allowed = set(required) | {"addressLine2", "landmark"}

    if not set(required).issubset(value.keys()):
        _invalid("Shipping address is missing required fields.")

    if not set(value.keys()).issubset(allowed):
        _invalid("Shipping address contains unsupported fields.")

    address = {
        field: _required_text(value[field], field)
        for field in required
    }

    for field in ("addressLine2", "landmark"):
        if field in value:
            address[field] = _required_text(value[field], field)

    return address


def _validate_items(value: object) -> list:
    """Validate cart identifiers and quantities, without accepting prices."""
    if not isinstance(value, list) or not value:
        _invalid("items must be a non-empty array.")

    if len(value) > MAX_ORDER_LINES:
        _invalid(f"An order may contain at most {MAX_ORDER_LINES} cart lines.")

    combined = {}

    for item in value:
        if not isinstance(item, dict):
            _invalid("Every cart item must be an object.")

        # Reject client-controlled prices and unexpected item properties.
        if set(item.keys()) != {"productId", "variantId", "quantity"}:
            _invalid(
                "Each item must contain only productId, variantId and quantity."
            )

        product_id = _required_text(item["productId"], "productId")
        variant_id = _required_text(item["variantId"], "variantId")
        quantity = item["quantity"]

        if not re.fullmatch(r"[A-Za-z0-9_-]{1,150}", product_id):
            _invalid("Invalid productId.")

        # Variant IDs must remain safe for Firestore field-path updates.
        if not re.fullmatch(r"[a-z0-9_]{1,100}", variant_id):
            _invalid("Invalid variantId.")

        if (
            isinstance(quantity, bool)
            or not isinstance(quantity, int)
            or quantity <= 0
        ):
            _invalid("Each quantity must be a positive integer.")

        key = (product_id, variant_id)
        combined[key] = combined.get(key, 0) + quantity

    return [
        {
            "productId": product_id,
            "variantId": variant_id,
            "quantity": quantity,
        }
        for (product_id, variant_id), quantity in combined.items()
    ]


def _order_response(order_id: str, data: dict, idempotent: bool) -> dict:
    return {
        "ok": True,
        "orderId": order_id,
        "orderNumber": data["orderNumber"],
        "status": data["status"],
        "totals": data["totals"],
        "idempotent": idempotent,
    }


def _create_order_transaction(
    transaction,
    uid: str,
    email: str,
    request_key_hash: str,
    order_ref,
    profile_ref,
    normalized_items: list,
    shipping_address: dict,
    now: datetime,
    payment_method: str,
    initial_status: str,
    payment_status: str,
    reserved_until=None,
):
    """Shared transactional order creation for COD and Paytm.

    Inventory is deducted atomically for COD orders and reserved inventory for
    Paytm orders. Paytm orders remain pending until server-side verification.
    All Firestore reads happen before any writes in this transaction.
    """

    # Idempotency: repeated submissions with the same key return the same order.
    existing_order = order_ref.get(transaction=transaction)

    if existing_order.exists:
        existing = existing_order.to_dict()

        if (
            existing.get("userId") == uid
            and existing.get("idempotencyKeyHash") == request_key_hash
            and existing.get("paymentMethod") == payment_method
        ):
            return _order_response(order_ref.id, existing, True)

        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.ALREADY_EXISTS,
            "This order identifier is already in use.",
        )

    profile_snapshot = profile_ref.get(transaction=transaction)

    if not profile_snapshot.exists:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Complete your customer profile before placing an order.",
        )

    profile = profile_snapshot.to_dict()
    customer_name = profile.get("name")
    customer_mobile = profile.get("mobile")

    if not isinstance(customer_name, str) or not customer_name.strip():
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Your customer profile needs a name.",
        )

    if not isinstance(customer_mobile, str) or not customer_mobile.strip():
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "Your customer profile needs a mobile number.",
        )

    # Read all referenced products before making any writes.
    product_refs = {
        item["productId"]: db.collection("products").document(
            item["productId"]
        )
        for item in normalized_items
    }

    product_snapshots = {
        product_id: ref.get(transaction=transaction)
        for product_id, ref in product_refs.items()
    }

    category_ids = set()

    for product_id, snapshot in product_snapshots.items():
        if not snapshot.exists:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.NOT_FOUND,
                f"Product {product_id} does not exist.",
            )

        product = snapshot.to_dict()

        if product.get("isActive") is not True:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Product {product_id} is unavailable.",
            )

        category_id = product.get("categoryId")
        if not isinstance(category_id, str) or not category_id:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Product {product_id} has an invalid category.",
            )

        category_ids.add(category_id)

    category_refs = {
        category_id: db.collection("categories").document(category_id)
        for category_id in category_ids
    }

    category_snapshots = {
        category_id: ref.get(transaction=transaction)
        for category_id, ref in category_refs.items()
    }

    for category_id, snapshot in category_snapshots.items():
        if not snapshot.exists or snapshot.get("isActive") is not True:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Category {category_id} is unavailable.",
            )

    # Validate every variant and calculate all amounts from Firestore data.
    order_items = []
    stock_updates = {}
    subtotal = 0

    for item in normalized_items:
        product_id = item["productId"]
        variant_id = item["variantId"]
        quantity = item["quantity"]
        product = product_snapshots[product_id].to_dict()
        variants = product.get("variants")

        if not isinstance(variants, dict):
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Product {product_id} has invalid variant data.",
            )

        variant = variants.get(variant_id)

        if not isinstance(variant, dict) or variant.get("isActive") is not True:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Variant {variant_id} is unavailable.",
            )

        price = variant.get("price")
        stock = variant.get("stock")
        mrp = variant.get("mrp")
        label = variant.get("label")
        sku = variant.get("sku", "")

        if (
            isinstance(price, bool)
            or not isinstance(price, int)
            or price <= 0
            or isinstance(stock, bool)
            or not isinstance(stock, int)
            or stock < 0
            or isinstance(mrp, bool)
            or not isinstance(mrp, int)
            or mrp < price
        ):
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Variant {variant_id} has invalid price or stock data.",
            )

        if not isinstance(label, str) or not label.strip():
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Variant {variant_id} has an invalid label.",
            )

        if not isinstance(sku, str):
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                f"Variant {variant_id} has an invalid SKU.",
            )

        if stock < quantity:
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
                f"Insufficient stock for {product.get('name', product_id)} ({label}).",
            )

        line_total = price * quantity
        subtotal += line_total

        images = product.get("images", [])
        image_path = (
            images[0]
            if isinstance(images, list)
            and images
            and isinstance(images[0], str)
            else None
        )

        order_item = {
            "productId": product_id,
            "variantId": variant_id,
            "productName": product.get("name", product_id),
            "variantLabel": label,
            "sku": sku,
            "unitPrice": price,
            "quantity": quantity,
            "lineTotal": line_total,
        }

        if image_path:
            order_item["imagePath"] = image_path

        weight = variant.get("weightGrams")
        if isinstance(weight, int) and not isinstance(weight, bool):
            order_item["weightGrams"] = weight

        order_items.append(order_item)

        stock_updates.setdefault(product_id, {})[variant_id] = (
            stock - quantity
        )

    shipping = SHIPPING_FEE_PAISE
    cod_fee = COD_FEE_PAISE if payment_method == "cod" else 0
    total = subtotal + shipping + cod_fee

    order_number = order_ref.id
    order_data = {
        "orderNumber": order_number,
        "userId": uid,
        "customer": {
            "name": customer_name.strip(),
            "email": email,
            "mobile": customer_mobile.strip(),
        },
        "shippingAddress": shipping_address,
        "items": order_items,
        "totals": {
            "subtotal": subtotal,
            "shipping": shipping,
            "codFee": cod_fee,
            "total": total,
        },
        "paymentMethod": payment_method,
        "payment": {
            "status": payment_status,
            "amount": total,
        },
        "status": initial_status,
        "statusHistory": [
            {
                "status": initial_status,
                "timestamp": now,
                "actor": {"type": "customer", "uid": uid},
            }
        ],
        "createdAt": now,
        "updatedAt": now,
        "schemaVersion": 1,
        "idempotencyKeyHash": request_key_hash,
    }

    if reserved_until is not None:
        order_data["reservedUntil"] = reserved_until

    # All reads are complete. Now reserve stock and create the order atomically.
    for product_id, variant_changes in stock_updates.items():
        updates = {
            f"variants.{variant_id}.stock": new_stock
            for variant_id, new_stock in variant_changes.items()
        }
        updates["updatedAt"] = now
        transaction.update(product_refs[product_id], updates)

    transaction.create(order_ref, order_data)

    return _order_response(order_ref.id, order_data, False)
