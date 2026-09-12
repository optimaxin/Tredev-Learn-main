"""Pure unit test: revoke_refresh_tokens() must no-op (return False) rather than
raise when the Firebase Admin SDK service-account env vars are still the
placeholders shipped in .env — this is the default state until a real
private key is filled in."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import firebase_auth


def test_revoke_refresh_tokens_noops_without_real_credentials(monkeypatch):
    monkeypatch.setenv("FIREBASE_PRIVATE_KEY", "your_real_private_key_id_here")
    monkeypatch.setattr(firebase_auth, "_admin_app", None)
    monkeypatch.setattr(firebase_auth, "_admin_app_tried", False)
    result = asyncio.run(firebase_auth.revoke_refresh_tokens("some-uid"))
    assert result is False


if __name__ == "__main__":
    import types
    class _Ctx:
        def setenv(self, k, v):
            import os
            os.environ[k] = v
        def setattr(self, obj, name, val):
            setattr(obj, name, val)
    test_revoke_refresh_tokens_noops_without_real_credentials(_Ctx())
    print("ok")
