"""Firebase Functions entry point.

Keep Firebase callable/scheduled exports imported here so the Firebase
Functions runtime can discover them. Firebase Admin initialization and the
shared Firestore client are owned by order_service.py; do not initialize a
second default app here.
"""

from firebase_admin import auth
from firebase_functions import https_fn

# Import the shared service first. It initializes Firebase Admin, creates the
# shared Firestore client, and configures the global Functions options.
from order_service import db as _db  # noqa: F401
from cod import createCodOrder
from paytm import (
    createPaytmOrder,
    verifyPaytmPayment,
    expirePendingPaytmOrders,
    
)



def _is_verified_admin(req: https_fn.CallableRequest) -> bool:
    """Return whether the callable request belongs to a verified admin."""
    if req.auth is None:
        return False

    token = req.auth.token
    return (
        token.get("admin") is True
        and token.get("email_verified") is True
    )


@https_fn.on_call()
def listAdminRoles(req: https_fn.CallableRequest):
    """List Firebase Authentication accounts with the admin custom claim.

    Only a verified admin may call this function. The role source of truth
    remains Firebase Authentication custom claims; no Firestore role list
    is created.
    """
    if not _is_verified_admin(req):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            "A verified admin account is required.",
        )

    admins = []
    page_token = None

    try:
        while True:
            page = auth.list_users(max_results=1000, page_token=page_token)

            for user in page.users:
                claims = user.custom_claims or {}
                if claims.get("admin") is True:
                    admins.append({
                        "uid": user.uid,
                        "email": user.email or "",
                        "displayName": user.display_name or "",
                        "emailVerified": bool(user.email_verified),
                    })

            page_token = page.next_page_token
            if not page_token:
                break

    except Exception as exc:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INTERNAL,
            "Unable to retrieve admin accounts.",
        ) from exc

    admins.sort(key=lambda item: (item["email"] or "").lower())

    return {"admins": admins}


@https_fn.on_call()
def setAdminRole(req: https_fn.CallableRequest):
    """Grant or revoke admin access.

    Only an existing admin with a verified email may call this function.
    The target account must already exist. After a claim change, the target
    must refresh their Firebase ID token.
    """
    if not _is_verified_admin(req):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            "A verified admin account is required.",
        )

    data = req.data
    if not isinstance(data, dict):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            "Request data must be an object.",
        )

    email = data.get("email")
    make_admin = data.get("makeAdmin")

    if (
        not isinstance(email, str)
        or not email.strip()
        or not isinstance(make_admin, bool)
    ):
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            "A non-empty email string and makeAdmin boolean are required.",
        )

    email = email.strip()

    try:
        user = auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.NOT_FOUND,
            "No account exists with that email. Ask the user to sign in once first.",
        )

    if make_admin and not user.email_verified:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "The target account's email must be verified before granting admin access.",
        )

    if user.uid == req.auth.uid and not make_admin:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            "You cannot remove your own admin role.",
        )

    # Preserve any unrelated custom claims.
    claims = dict(user.custom_claims or {})
    if make_admin:
        claims["admin"] = True
    else:
        claims.pop("admin", None)

    try:
        auth.set_custom_user_claims(user.uid, claims or None)
    except Exception as exc:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.INTERNAL,
            "Unable to update the user's admin role.",
        ) from exc

    return {"ok": True, "uid": user.uid, "admin": make_admin}
