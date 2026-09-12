"""
Self-managed email OTP verification.

Replaces Firebase's link-based email verification: its emails come from
Firebase's default *.firebaseapp.com sender, which Google throttles/spam-
filters hard, so they often never arrive. This sends a 6-digit code
ourselves through ZeptoMail's HTTP API instead.

Env:
  ZEPTOMAIL_TOKEN, ZEPTOMAIL_API_URL     ZeptoMail send-mail-token + API endpoint
  EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME    sender identity
"""
import asyncio
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import requests

OTP_TTL_MINUTES = 10


class OtpSendError(Exception):
    """Raised when the OTP email couldn't be sent (SMTP not configured, relay
    rejected it, etc). Callers should treat this like firebase_auth.AuthError:
    log it and tell the user the send failed instead of claiming success."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def expiry_timestamp() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()


def is_expired(expires_at) -> bool:
    if not expires_at:
        return True
    try:
        ts = expires_at if isinstance(expires_at, datetime) else datetime.fromisoformat(expires_at)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts < datetime.now(timezone.utc)
    except ValueError:
        return True


def _send_sync(to_email: str, code: str):
    token = os.environ.get("ZEPTOMAIL_TOKEN")
    api_url = os.environ.get("ZEPTOMAIL_API_URL")
    from_address = os.environ.get("EMAIL_FROM_ADDRESS")
    from_name = os.environ.get("EMAIL_FROM_NAME", "Tredev Learn")
    if not token or not api_url or not from_address:
        raise OtpSendError(
            "ZeptoMail is not configured (ZEPTOMAIL_TOKEN/ZEPTOMAIL_API_URL/EMAIL_FROM_ADDRESS)"
        )

    body = (
        f"Your verification code is {code}. It expires in {OTP_TTL_MINUTES} minutes.<br><br>"
        "If you didn't request this, you can ignore this email."
    )
    payload = {
        "from": {"address": from_address, "name": from_name},
        "to": [{"email_address": {"address": to_email}}],
        "subject": "Your Tredev Learn verification code",
        "htmlbody": body,
    }
    headers = {
        "Authorization": token if token.startswith("Zoho-enczapikey") else f"Zoho-enczapikey {token}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(api_url, json=payload, headers=headers, timeout=15)
        if resp.status_code >= 400:
            raise OtpSendError(f"ZeptoMail rejected the send ({resp.status_code}): {resp.text}")
    except requests.RequestException as e:
        raise OtpSendError(str(e))


async def send_code_email(to_email: str, code: str):
    await asyncio.to_thread(_send_sync, to_email, code)
