"""Reusable Resend email service for Spiritual Vastu Bhandar."""

import html
import logging
import os
from decimal import Decimal
from typing import Any

import resend

from order_service import db

logger = logging.getLogger(__name__)
TEMPLATE_ALIAS = os.getenv("EMAIL_TEMPLATE_ALIAS", "order-confirmation")
OWNER_EMAIL = os.getenv(
    "OWNER_EMAIL",
    "vatvrukshaswamimaharajeseva@gmail.com",
)
REPLY_TO_EMAIL = os.getenv("RESEND_REPLY_TO_EMAIL", OWNER_EMAIL)
DEFAULT_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "Vatvruksha Swami Maharaj Spiritual Vastu Bhandar <orders@vatvrukshaswamimaharajeseva.com>",
)


def _escape(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _money(paise: Any) -> str:
    if isinstance(paise, bool) or not isinstance(paise, int):
        raise ValueError("Order amounts must be integer paise.")
    return f"₹{Decimal(paise) / Decimal(100):,.2f}"


def build_item_rows_html(items: list[dict[str, Any]]) -> str:
    """Build simple styled paragraphs; intentionally no HTML table."""
    if not isinstance(items, list) or not items:
        raise ValueError("At least one order item is required.")
    rows = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each order item must be an object.")
        name = _escape(item.get("productName", item.get("name", "")))
        variant = _escape(item.get("variantLabel", item.get("variant", "")))
        qty = item.get("quantity")
        line_total = item.get("lineTotal", item.get("line_total"))
        if not name or isinstance(qty, bool) or not isinstance(qty, int) or qty < 1:
            raise ValueError("Order item has invalid name or quantity.")
        if isinstance(line_total, int) and not isinstance(line_total, bool):
            total_text = _money(line_total)
        elif isinstance(line_total, str) and line_total.strip():
            total_text = _escape(line_total.strip())
        else:
            raise ValueError("Order item has invalid line total.")
        variant_html = (f'<div style="padding-top:3px;font-size:12px;color:#78716c">{variant}</div>') if variant else ""
        rows.append(
            '<div style="padding:12px 4px;border-bottom:1px solid #eee8df;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7">'
            f'<div style="font-weight:bold;color:#563b23">{name}</div>{variant_html}'
            f'<div style="padding-top:3px;color:#57534e">Qty: {qty}'
            f'<span style="float:right;font-weight:bold;color:#292524">{total_text}</span></div></div>'
        )
    return "".join(rows)


def build_shipping_address_html(address: dict[str, Any]) -> str:
    """Build an escaped address block from the validated stored address."""
    if not isinstance(address, dict):
        raise ValueError("Shipping address must be an object.")
    keys = ("fullName", "addressLine1", "addressLine2", "landmark", "city", "state", "pincode")
    lines = [_escape(address.get(k, "")).strip() for k in keys]
    lines = [line for line in lines if line]
    if not lines:
        raise ValueError("Shipping address is empty.")
    return "<br>".join(lines)


def _format_order_variables(order: dict, *, recipient_type: str) -> dict[str, str]:
    customer = order.get("customer") or {}
    address = order.get("shippingAddress") or {}
    totals = order.get("totals") or {}
    items = order.get("items") or []
    method = str(order.get("paymentMethod", "")).lower()
    payment = order.get("payment") or {}
    is_owner = recipient_type == "owner"
    status = str(order.get("status", "unknown"))
    payment_status = str(payment.get("status", "unknown"))
    method_label = "Cash on Delivery" if method == "cod" else "Paytm"
    if method == "cod":
        payment_label = "Payable on delivery"
    elif payment_status == "paid":
        payment_label = "Paid"
    else:
        payment_label = payment_status.replace("_", " ").title()

    created = order.get("createdAt")
    if hasattr(created, "strftime"):
        order_date = created.strftime("%d %b %Y")
    else:
        order_date = "Date unavailable"

    subtotal = _money(totals.get("subtotal", 0))
    shipping = _money(totals.get("shipping", 0))
    cod_fee = _money(totals.get("codFee", 0))
    final_total = _money(totals.get("total", 0))
    return {
        "EMAIL_HEADING": "New order received" if is_owner else "Order confirmed",
        "RECIPIENT_NAME": _escape("Spiritual Vastu Bhandar Team" if is_owner else customer.get("name", "Customer")),
        "INTRO_MESSAGE": _escape("A new order has been placed. Please review the order details." if is_owner else "Thank you for your order. Here are your order and delivery details."),
        "ORDER_NUMBER": _escape(order.get("orderNumber", "")),
        "ORDER_DATE": _escape(order_date),
        "ORDER_STATUS": _escape(status.replace("_", " ").title()),
        "PAYMENT_METHOD": _escape(method_label),
        "PAYMENT_STATUS": _escape(payment_label),
        "ITEM_ROWS_HTML": build_item_rows_html(items),
        "SUBTOTAL": _escape(subtotal),
        "SHIPPING": _escape(shipping),
        "COD_FEE": _escape(cod_fee),
        "FINAL_AMOUNT_LABEL": _escape("Amount to collect" if is_owner and method == "cod" else "Amount payable" if method == "cod" else "Order total"),
        "FINAL_TOTAL": _escape(final_total),
        "TOTAL_NOTE": _escape("Collect this amount on delivery." if is_owner and method == "cod" else "Please pay this amount when your order is delivered." if method == "cod" else "Payment has been verified by Paytm."),
        "SHIPPING_ADDRESS_HTML": build_shipping_address_html(address),
        "CUSTOMER_PHONE": _escape(address.get("mobile") or customer.get("mobile") or "Not provided"),
    }


def send_order_email(recipient_email: str, variables: dict[str, Any]) -> bool:
    """Send a published template email. False means delivery was not accepted."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.error("RESEND_API_KEY is not configured.")
        return False
    if not isinstance(recipient_email, str) or not recipient_email.strip():
        logger.error("Email recipient is missing.")
        return False
    if not isinstance(variables, dict):
        logger.error("Template variables must be a dictionary.")
        return False
    try:
        resend.api_key = api_key
        response = resend.Emails.send({
            "from": os.getenv("RESEND_FROM_EMAIL", DEFAULT_FROM_EMAIL),
            "to": [recipient_email.strip()],
            "reply_to": REPLY_TO_EMAIL,
            "template": {"id": TEMPLATE_ALIAS, "variables": variables},
        })
        email_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        if not email_id:
            logger.error("Resend returned no email ID; acceptance is unconfirmed.")
            return False
        logger.info("Resend accepted email; id=%s", email_id)
        return True
    except Exception:
        logger.exception("Resend failed to send an order email.")
        return False


def send_order_notifications(order: dict) -> dict[str, bool]:
    """Send customer and owner notices for an eligible order state.

    This helper is server-side only. Never expose arbitrary recipients or template
    variables through a public callable. Admin review actions should use a separate
    admin-authorized callable which loads the order from Firestore.
    """
    customer_email = (order.get("customer") or {}).get("email")
    results = {"customer": False, "owner": False}
    try:
        customer_vars = _format_order_variables(order, recipient_type="customer")
        owner_vars = _format_order_variables(order, recipient_type="owner")
    except Exception:
        logger.exception("Unable to build order email variables.")
        return results
    if isinstance(customer_email, str) and customer_email.strip():
        results["customer"] = send_order_email(customer_email, customer_vars)
    else:
        logger.warning("Order has no customer email; customer notification skipped.")
    results["owner"] = send_order_email(OWNER_EMAIL, owner_vars)
    return results
