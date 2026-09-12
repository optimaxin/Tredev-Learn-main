"""Pure unit tests for the self-managed email OTP helpers (no SMTP, no DB)."""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import otp_auth


def test_generate_code_is_six_digits():
    code = otp_auth.generate_code()
    assert len(code) == 6 and code.isdigit()


def test_hash_is_deterministic_and_distinguishes_codes():
    assert otp_auth.hash_code("123456") == otp_auth.hash_code("123456")
    assert otp_auth.hash_code("123456") != otp_auth.hash_code("654321")


def test_expiry_not_expired_when_fresh():
    assert otp_auth.is_expired(otp_auth.expiry_timestamp()) is False


def test_expiry_expired_when_in_past():
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert otp_auth.is_expired(past) is True


def test_expiry_expired_when_missing():
    assert otp_auth.is_expired(None) is True
    assert otp_auth.is_expired("") is True


if __name__ == "__main__":
    test_generate_code_is_six_digits()
    test_hash_is_deterministic_and_distinguishes_codes()
    test_expiry_not_expired_when_fresh()
    test_expiry_expired_when_in_past()
    test_expiry_expired_when_missing()
    print("ok")
