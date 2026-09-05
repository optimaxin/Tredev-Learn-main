"""Community Chat integration tests — hits a live running backend. Self-contained:
duplicates backend_test.py's tiny login helper rather than importing from it."""
import os
import requests
import pytest
from websockets.sync.client import connect as ws_connect

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

CREDS = {
    "learner": ("learner@tredevlearn.com", "Learner@123"),
    "staff": ("staff@tredevlearn.com", "Staff@123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def tokens():
    return {role: _login(email, pw) for role, (email, pw) in CREDS.items()}


def auth_headers(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_non_staff_cannot_create_channel(tokens):
    r = requests.post(f"{API}/channels", json={"name": "nope"}, headers=auth_headers(tokens["learner"]))
    assert r.status_code == 403


def test_staff_creates_public_channel_and_it_is_listed(tokens):
    r = requests.post(f"{API}/channels", json={"name": "test-public", "type": "PUBLIC"},
                       headers=auth_headers(tokens["staff"]))
    assert r.status_code == 201, r.text
    channel = r.json()

    r2 = requests.get(f"{API}/channels", headers=auth_headers(tokens["staff"]))
    assert r2.status_code == 200
    assert any(c["id"] == channel["id"] for c in r2.json()["channels"])

    requests.delete(f"{API}/channels/{channel['id']}", headers=auth_headers(tokens["staff"]))


def test_course_private_channel_blocks_unenrolled_learner(tokens):
    offerings = requests.get(f"{API}/offerings").json()
    assert offerings, "need at least one offering seeded"
    course_id = offerings[0]["id"]

    r = requests.post(f"{API}/channels", json={"name": "test-private", "type": "COURSE_PRIVATE", "course_id": course_id},
                       headers=auth_headers(tokens["staff"]))
    assert r.status_code == 201, r.text
    channel = r.json()

    r_learner = requests.get(f"{API}/channels/{channel['id']}/messages", headers=auth_headers(tokens["learner"]))
    assert r_learner.status_code == 403

    r_staff = requests.get(f"{API}/channels/{channel['id']}/messages", headers=auth_headers(tokens["staff"]))
    assert r_staff.status_code == 200

    requests.delete(f"{API}/channels/{channel['id']}", headers=auth_headers(tokens["staff"]))


def test_channel_delete_is_staff_only(tokens):
    r = requests.post(f"{API}/channels", json={"name": "test-delete-me", "type": "PUBLIC"},
                       headers=auth_headers(tokens["staff"]))
    channel = r.json()

    r_learner = requests.delete(f"{API}/channels/{channel['id']}", headers=auth_headers(tokens["learner"]))
    assert r_learner.status_code == 403

    r_staff = requests.delete(f"{API}/channels/{channel['id']}", headers=auth_headers(tokens["staff"]))
    assert r_staff.status_code in (200, 204)


def test_websocket_message_roundtrip(tokens):
    channels = requests.get(f"{API}/channels", headers=auth_headers(tokens["staff"])).json()["channels"]
    general = next(c for c in channels if c["name"] == "general")

    url = f"{WS_BASE}/api/ws/chat/{general['id']}?token={tokens['staff']}"
    with ws_connect(url) as ws:
        ws.send('{"type":"message","content":"hello from test"}')
        frame = ws.recv(timeout=10)
        import json
        payload = json.loads(frame)
        assert payload["type"] == "message"
        assert payload["message"]["content"] == "hello from test"
