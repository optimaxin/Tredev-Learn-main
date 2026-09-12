"""Pure unit test: RegisterIn must reject passwords that don't meet the new
policy (8+ chars, at least one letter and one digit) before they ever reach
Firebase, and accept ones that do."""
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server import RegisterIn


@pytest.mark.parametrize("password", ["short1", "alllettersnodigit", "12345678", ""])
def test_register_rejects_weak_passwords(password):
    with pytest.raises(ValidationError):
        RegisterIn(email="user@example.com", name="User", password=password)


def test_register_accepts_valid_password():
    data = RegisterIn(email="user@example.com", name="User", password="Passw0rd")
    assert data.password == "Passw0rd"


@pytest.mark.parametrize("email", ["kadon36910@crybio.com", "someone@mailinator.com", "x@yopmail.com"])
def test_register_rejects_disposable_email(email):
    with pytest.raises(ValidationError):
        RegisterIn(email=email, name="User", password="Passw0rd")


def test_register_accepts_real_email():
    data = RegisterIn(email="user@gmail.com", name="User", password="Passw0rd")
    assert data.email == "user@gmail.com"


if __name__ == "__main__":
    test_register_accepts_valid_password()
    test_register_accepts_real_email()
    for pw in ["short1", "alllettersnodigit", "12345678", ""]:
        try:
            RegisterIn(email="user@example.com", name="User", password=pw)
            raise SystemExit(f"expected rejection for password={pw!r}")
        except ValidationError:
            pass
    for email in ["kadon36910@crybio.com", "someone@mailinator.com", "x@yopmail.com"]:
        try:
            RegisterIn(email=email, name="User", password="Passw0rd")
            raise SystemExit(f"expected rejection for email={email!r}")
        except ValidationError:
            pass
    print("ok")
