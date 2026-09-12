"""
Firebase Authentication — backend-mediated, REST-only.

Identity (email + password) is owned by Firebase Auth. This module talks to the
Firebase Auth REST API (Identity Toolkit) using only the project's Web API key,
so no Admin SDK / service-account key is required:

  - register  -> accounts:signUp
  - login     -> accounts:signInWithPassword
  - verify    -> accounts:lookup (validates the ID token, returns the uid)
  - seeding   -> signUp, falling back to signInWithPassword to fetch the uid

The frontend contract (POST /api/auth/{register,login}) is unchanged: it sends
email/password and receives a token.

Env:
  FIREBASE_WEB_API_KEY   Web API key (Firebase console → Project settings)
"""
import asyncio
import base64
import json
import os

import requests

_IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts"

# Admin SDK is optional: only used for a hard force-logout (revoke refresh
# tokens). Everything else in this module stays REST-only/Admin-SDK-free.
_admin_app = None
_admin_app_tried = False


def _admin_app_or_none():
    """Lazily initialise the Firebase Admin SDK from FIREBASE_* service-account
    env vars, if they've been filled in with real values. Returns None (not an
    error) when they're missing or still placeholders, so callers can fall
    back to the soft (non-Admin-SDK) equivalent."""
    global _admin_app, _admin_app_tried
    if _admin_app_tried:
        return _admin_app
    _admin_app_tried = True
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "")
    if not private_key or "YOUR_REAL_KEY_HERE" in private_key:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate({
            "type": os.environ.get("FIREBASE_TYPE", "service_account"),
            "project_id": os.environ.get("FIREBASE_PROJECT_ID", ""),
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
            "private_key": private_key.replace("\\n", "\n"),
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL", ""),
            "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
            "auth_uri": os.environ.get("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
            "token_uri": os.environ.get("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
            "auth_provider_x509_cert_url": os.environ.get("FIREBASE_AUTH_PROVIDER_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
            "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_CERT_URL", ""),
            "universe_domain": os.environ.get("FIREBASE_UNIVERSE_DOMAIN", "googleapis.com"),
        })
        _admin_app = firebase_admin.initialize_app(cred)
    except Exception:
        _admin_app = None
    return _admin_app


async def revoke_refresh_tokens(uid: str) -> bool:
    """Hard force-logout: invalidates every refresh token for `uid` immediately,
    everywhere. Returns False (no-op) when the Admin SDK isn't configured yet —
    callers should keep relying on the soft force_logout_at check in that case."""
    app = _admin_app_or_none()
    if not app:
        return False
    from firebase_admin import auth as admin_auth
    await asyncio.to_thread(admin_auth.revoke_refresh_tokens, uid, app=app)
    return True


class AuthError(Exception):
    """Raised on authentication failures; carries an HTTP status + message."""

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


def init_firebase():
    # REST-only: nothing to initialise, but validate config early.
    if not os.environ.get("FIREBASE_WEB_API_KEY"):
        raise AuthError(500, "FIREBASE_WEB_API_KEY is not configured")


def _web_api_key() -> str:
    key = os.environ.get("FIREBASE_WEB_API_KEY")
    if not key:
        raise AuthError(500, "FIREBASE_WEB_API_KEY is not configured")
    return key


def _rest(endpoint: str, payload: dict) -> dict:
    resp = requests.post(
        f"{_IDENTITY_TOOLKIT}:{endpoint}",
        params={"key": _web_api_key()},
        json=payload,
        timeout=15,
    )
    data = resp.json() if resp.content else {}
    if resp.status_code != 200:
        err = (data.get("error", {}) or {}).get("message", "AUTH_ERROR")
        raise AuthError(_map_status(err), _friendly(err))
    return data


def _map_status(code: str) -> int:
    if code.startswith("EMAIL_EXISTS"):
        return 400
    if code.startswith(("INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD",
                        "EMAIL_NOT_FOUND", "USER_DISABLED", "INVALID_EMAIL",
                        "INVALID_ID_TOKEN", "TOKEN_EXPIRED")):
        return 401
    if code.startswith("WEAK_PASSWORD"):
        return 400
    return 400


def _friendly(code: str) -> str:
    if code.startswith("EMAIL_EXISTS"):
        return "Email already registered"
    if code.startswith(("INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD",
                        "EMAIL_NOT_FOUND", "USER_DISABLED")):
        return "Invalid credentials"
    if code.startswith(("INVALID_ID_TOKEN", "TOKEN_EXPIRED")):
        return "Invalid or expired token"
    if code.startswith("WEAK_PASSWORD"):
        return "Password should be at least 6 characters"
    return code.replace("_", " ").title()


# ---- async wrappers -------------------------------------------------------
async def verify_id_token(token: str) -> dict:
    """Validate an ID token via accounts:lookup; returns {"uid": ..., ...}."""
    data = await asyncio.to_thread(_rest, "lookup", {"idToken": token})
    users = data.get("users") or []
    if not users:
        raise AuthError(401, "Invalid token")
    u = users[0]
    return {"uid": u.get("localId"), "email": u.get("email"),
            "name": u.get("displayName", ""), "picture": u.get("photoUrl", ""),
            "email_verified": bool(u.get("emailVerified", False)),
            "phone": u.get("phoneNumber", "")}


def token_issued_at(token: str) -> int:
    """Read the unverified `iat` claim out of an ID token's payload.

    Safe to trust without re-verifying the signature here: this is only ever
    called right after verify_id_token() succeeded, meaning Firebase's
    accounts:lookup already validated the token's signature and expiry.
    Returns 0 (never later than any force_logout_at) if the token is malformed.
    """
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
        return int(claims.get("iat", 0))
    except Exception:
        return 0


async def sign_up(email: str, password: str):
    """Create a Firebase user via password sign-up. Returns (uid, id_token)."""
    data = await asyncio.to_thread(
        _rest, "signUp",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    return data["localId"], data["idToken"]


async def send_password_reset(email: str):
    """Trigger Firebase's password-reset email via the same REST surface as
    sign-up/sign-in (no Admin SDK needed)."""
    await asyncio.to_thread(
        _rest, "sendOobCode", {"requestType": "PASSWORD_RESET", "email": email},
    )


async def send_verification_email(id_token: str):
    """Trigger Firebase's email-verification link for the account owning `id_token`
    (same REST surface as the password-reset email, no Admin SDK needed)."""
    await asyncio.to_thread(
        _rest, "sendOobCode", {"requestType": "VERIFY_EMAIL", "idToken": id_token},
    )


async def sign_in(email: str, password: str):
    """Sign in with email/password. Returns (uid, id_token)."""
    data = await asyncio.to_thread(
        _rest, "signInWithPassword",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    return data["localId"], data["idToken"]


async def ensure_user(email: str, password: str, display_name: str = "") -> str:
    """Create-or-find a seed user; returns its Firebase uid.

    Tries signUp first; if the account already exists, signs in with the known
    seed password to recover the uid (idempotent across re-seeds).
    """
    try:
        uid, _ = await sign_up(email, password)
        return uid
    except AuthError as e:
        if e.status != 400 or "already" not in e.message.lower():
            raise
        uid, _ = await sign_in(email, password)
        return uid
