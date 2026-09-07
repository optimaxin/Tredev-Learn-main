"""
Cashfree Payment Gateway (PG) — REST integration, sandbox ("TEST") by default.

Endpoint paths and the x-api-version header follow Cashfree's PG API v3 as
published at https://docs.cashfree.com/reference at the time this was written.
If a call starts failing with an unexpected 4xx, check that version string
against Cashfree's current docs first — gateway APIs occasionally rev it.

Env:
  CASHFREE_APP_ID       App ID (Cashfree dashboard -> Developers -> API Keys)
  CASHFREE_SECRET_KEY   Secret Key, same page
  CASHFREE_ENV          "TEST" (default) or "PROD" -- selects sandbox vs live host
"""
import base64
import hashlib
import hmac
import os

import requests

API_VERSION = "2023-08-01"


class CashfreeError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


def _env() -> str:
    return os.environ.get("CASHFREE_ENV", "TEST").upper()


def _base_url() -> str:
    return "https://api.cashfree.com/pg" if _env() == "PROD" else "https://sandbox.cashfree.com/pg"


def _headers() -> dict:
    app_id = os.environ.get("CASHFREE_APP_ID", "")
    secret = os.environ.get("CASHFREE_SECRET_KEY", "")
    if not app_id or not secret:
        raise CashfreeError(500, "Cashfree isn't configured — set CASHFREE_APP_ID / CASHFREE_SECRET_KEY.")
    return {
        "x-client-id": app_id,
        "x-client-secret": secret,
        "x-api-version": API_VERSION,
        "Content-Type": "application/json",
    }


def _request(method: str, path: str, **kwargs) -> dict:
    resp = requests.request(method, f"{_base_url()}{path}", headers=_headers(), timeout=15, **kwargs)
    data = resp.json() if resp.content else {}
    if not resp.ok:
        raise CashfreeError(resp.status_code, data.get("message") or "Cashfree request failed")
    return data


def create_order(order_id: str, amount: float, currency: str, customer_id: str,
                  customer_email: str, customer_phone: str, return_url: str) -> dict:
    """Creates a Cashfree order. Returns the raw response (payment_session_id,
    cf_order_id, order_status, ...)."""
    payload = {
        "order_id": order_id,
        "order_amount": round(amount, 2),
        "order_currency": currency,
        "customer_details": {
            "customer_id": customer_id,
            "customer_email": customer_email or "guest@tredevlearn.com",
            "customer_phone": customer_phone or "9999999999",
        },
        "order_meta": {"return_url": f"{return_url}?order_id={{order_id}}"},
    }
    return _request("POST", "/orders", json=payload)


def get_order_status(order_id: str) -> dict:
    """Order-status reconciliation fallback for when a webhook is delayed or
    dropped. Returns Cashfree's order object (order_status: ACTIVE | PAID |
    EXPIRED | TERMINATED | ...)."""
    return _request("GET", f"/orders/{order_id}")


def verify_webhook_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    """Cashfree signs webhooks as base64(HMAC-SHA256(secret, timestamp + raw_body)).
    Reject anything that doesn't match — this is the check the old mocked
    webhook never had."""
    secret = os.environ.get("CASHFREE_SECRET_KEY", "")
    if not secret or not timestamp or not signature:
        return False
    computed = base64.b64encode(
        hmac.new(secret.encode(), (timestamp + raw_body.decode("utf-8")).encode(), hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(computed, signature)
