"""
Tredev Learn — Backend API integration tests.
Tests auth, RBAC, offerings, verses, sadhana, calculators, consultations,
certificates, payments (mocked), community, audit-log.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
# fallback: read from frontend env
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

API = f"{BASE_URL}/api"

CREDS = {
    "learner":     ("learner@tredevlearn.com",    "Learner@123"),
    "acharya":     ("acharya@tredevlearn.com",    "Acharya@123"),
    "staff":       ("staff@tredevlearn.com",      "Staff@123"),
    "admin":       ("admin@tredevlearn.com",      "Admin@123"),
    "super_admin": ("superadmin@tredevlearn.com", "SuperAdmin@123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for role, (email, pw) in CREDS.items():
        tok, user = _login(email, pw)
        out[role] = {"token": tok, "user": user}
    return out


def auth_headers(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- AUTH ----------------
class TestAuth:
    def test_all_seeded_logins(self, tokens):
        for role, info in tokens.items():
            assert info["user"]["email"] == CREDS[role][0]
            # role check: super_admin login user role must be super_admin (not admin)
            expected = "academic_staff" if role == "staff" else role
            assert info["user"]["role"] == expected, f"{role} got role {info['user']['role']}"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "learner@tredevlearn.com", "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test@1234", "name": "TEST User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "learner"
        token = data["token"]
        r2 = requests.get(f"{API}/auth/me", headers=auth_headers(token))
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == email

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={"email": "learner@tredevlearn.com", "password": "x123456", "name": "dup"})
        assert r.status_code == 400

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- OFFERINGS ----------------
class TestOfferings:
    def test_list_offerings(self):
        r = requests.get(f"{API}/offerings")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5
        assert all("id" in i for i in items)

    def test_filter_by_type(self):
        r = requests.get(f"{API}/offerings", params={"type": "sadhana"})
        assert r.status_code == 200
        items = r.json()
        assert all(i["type"] == "sadhana" for i in items)
        assert any("Rudram" in i["title"] for i in items)

    def test_filter_by_track(self):
        r = requests.get(f"{API}/offerings", params={"track": "A"})
        assert r.status_code == 200
        assert all(i["track"] == "A" for i in r.json())

    def test_get_offering_with_acharya_and_verses(self):
        items = requests.get(f"{API}/offerings").json()
        gita = next(i for i in items if "Bhagavad Gita" in i["title"] and i["type"] == "recorded_course")
        r = requests.get(f"{API}/offerings/{gita['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data.get("acharya") is not None
        assert data.get("acharya", {}).get("role") == "acharya"
        assert isinstance(data.get("verses_full", []), list)
        assert len(data["verses_full"]) > 0


# ---------------- VERSES ----------------
class TestVerses:
    def test_list(self):
        r = requests.get(f"{API}/verses")
        assert r.status_code == 200 and len(r.json()) >= 5

    def test_shloka_of_day(self):
        r = requests.get(f"{API}/shloka-of-day")
        assert r.status_code == 200
        d = r.json()
        assert "devanagari" in d and "iast" in d


# ---------------- SADHANA ----------------
class TestSadhana:
    def test_sadhana_flow(self, tokens):
        tok = tokens["learner"]["token"]
        items = requests.get(f"{API}/offerings", params={"type": "sadhana"}).json()
        sid = items[0]["id"]
        # pay & enroll via mock
        order = requests.post(f"{API}/payments/create-order", json={"offering_id": sid}, headers=auth_headers(tok)).json()
        assert order.get("mocked") is True
        r = requests.post(f"{API}/payments/webhook-mock", json={"order_id": order["order_id"]})
        assert r.status_code == 200
        # sankalpa
        r = requests.post(f"{API}/sadhana/sankalpa", json={"offering_id": sid, "sankalpa": "TEST sankalpa"}, headers=auth_headers(tok))
        assert r.status_code == 200
        # checkin - reset previous checkin for today by hitting an idempotent path; just check-in fresh
        r = requests.post(f"{API}/sadhana/checkin", json={"offering_id": sid, "japa_count": 108, "notes": "test"}, headers=auth_headers(tok))
        assert r.status_code == 200
        body = r.json()
        # If not already done, streak >=1 and total_japa >=108
        if not body.get("already_done"):
            assert body.get("streak", 0) >= 1
            assert body.get("total_japa", 0) >= 108
        # verify
        r = requests.get(f"{API}/sadhana/{sid}", headers=auth_headers(tok))
        assert r.status_code == 200
        d = r.json()
        assert d.get("sankalpa") == "TEST sankalpa"


# ---------------- CALCULATORS ----------------
class TestCalculators:
    def test_panchang(self):
        r = requests.get(f"{API}/calculators/panchang", params={"d": "2026-01-15"})
        assert r.status_code == 200
        d = r.json()
        for k in ["tithi", "nakshatra", "yoga", "karana", "vara"]:
            assert d.get(k)

    def test_numerology(self):
        r = requests.post(f"{API}/calculators/numerology", json={"name": "Arjuna", "dob": "1990-05-12"})
        assert r.status_code == 200
        d = r.json()
        assert d["destiny_number"] is not None
        assert d["life_path_number"] is not None

    def test_kundli(self):
        r = requests.post(f"{API}/calculators/kundli", json={"name": "A", "dob": "1990-01-01", "tob": "10:00", "pob": "Pune"})
        assert r.status_code == 200
        d = r.json()
        assert len(d["houses"]) == 12
        assert d["ascendant"] in [
            "Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya","Tula","Vrishchika","Dhanu","Makara","Kumbha","Meena"]

    def test_transliteration(self):
        r = requests.get(f"{API}/calculators/transliterate", params={"text": "om namah"})
        assert r.status_code == 200
        assert r.json()["devanagari"]


# ---------------- CONSULTATION ----------------
class TestConsultation:
    def test_reject_no_consent(self):
        r = requests.post(f"{API}/consultations", json={
            "name": "T", "email": "t@t.com", "phone": "123", "interest": "gita", "consent": False})
        assert r.status_code == 400

    def test_submit_assigns_staff(self, tokens):
        r = requests.post(f"{API}/consultations", json={
            "name": "TEST A", "email": "a@t.com", "phone": "111", "interest": "gita", "consent": True})
        assert r.status_code == 200
        d = r.json()
        assert d["assigned_to"] == tokens["staff"]["user"]["id"]
        assert d["expected_callback"]

    def test_load_balancing_two_requests(self):
        # Second consultation should still be assigned (same staff since only one, but should succeed)
        r2 = requests.post(f"{API}/consultations", json={
            "name": "TEST B", "email": "b@t.com", "phone": "222", "interest": "sanskrit", "consent": True})
        assert r2.status_code == 200
        assert r2.json()["assigned_to"]


# ---------------- CERTIFICATES ----------------
class TestCertificates:
    def test_verify_not_found(self):
        r = requests.get(f"{API}/certificates/verify/DOES-NOT-EXIST")
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is False

    def test_issue_and_verify(self, tokens):
        # admin issues cert to learner for an offering
        learner_id = tokens["learner"]["user"]["id"]
        off = requests.get(f"{API}/offerings").json()[0]
        r = requests.post(f"{API}/certificates/issue",
            json={"user_id": learner_id, "offering_id": off["id"]},
            headers=auth_headers(tokens["admin"]["token"]))
        assert r.status_code == 200, r.text
        code = r.json()["code"]
        # public verify no auth
        r2 = requests.get(f"{API}/certificates/verify/{code}")
        assert r2.status_code == 200
        assert r2.json()["valid"] is True

    def test_verify_public_no_auth(self):
        # already covered above with a fresh session
        r = requests.get(f"{API}/certificates/verify/ANY-CODE")
        assert r.status_code == 200


# ---------------- RBAC / AUDIT ----------------
class TestRBAC:
    def test_audit_log_requires_admin(self):
        r = requests.get(f"{API}/audit-log")
        assert r.status_code == 401

    def test_audit_log_learner_forbidden(self, tokens):
        r = requests.get(f"{API}/audit-log", headers=auth_headers(tokens["learner"]["token"]))
        assert r.status_code == 403

    def test_audit_log_admin_ok(self, tokens):
        r = requests.get(f"{API}/audit-log", headers=auth_headers(tokens["admin"]["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_users_list_admin(self, tokens):
        r = requests.get(f"{API}/users", headers=auth_headers(tokens["admin"]["token"]))
        assert r.status_code == 200

    def test_users_list_learner_forbidden(self, tokens):
        r = requests.get(f"{API}/users", headers=auth_headers(tokens["learner"]["token"]))
        assert r.status_code == 403

    def test_admin_cannot_appoint_superadmin(self, tokens):
        # try to change learner to super_admin via admin
        learner_id = tokens["learner"]["user"]["id"]
        r = requests.patch(f"{API}/users/{learner_id}",
            json={"role": "super_admin"}, headers=auth_headers(tokens["admin"]["token"]))
        assert r.status_code == 403


# ---------------- OFFERINGS: CREATE + APPROVAL ----------------
class TestApprovalFlow:
    def test_staff_create_and_acharya_approve(self, tokens):
        acharya_id = tokens["acharya"]["user"]["id"]
        payload = {
            "title": "TEST Draft Offering", "subtitle": "t", "description": "d",
            "type": "workshop", "track": "A", "subject": "Vedas",
            "price_inr": 0, "price_usd": 0, "duration": "1 day",
            "acharya_id": acharya_id, "verses": [], "modules": [],
            "image_url": "", "is_published": False, "festival": "", "start_date": ""
        }
        r = requests.post(f"{API}/offerings", json=payload, headers=auth_headers(tokens["staff"]["token"]))
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        # acharya approves
        r2 = requests.post(f"{API}/offerings/{oid}/approval",
            json={"approved": True, "notes": "ok"},
            headers=auth_headers(tokens["acharya"]["token"]))
        assert r2.status_code == 200


# ---------------- COMMUNITY ----------------
class TestCommunity:
    def test_list_public(self):
        r = requests.get(f"{API}/community/posts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_requires_auth(self):
        r = requests.post(f"{API}/community/posts", json={"body": "hi"})
        assert r.status_code == 401

    def test_post_ok(self, tokens):
        r = requests.post(f"{API}/community/posts", json={"body": "TEST post"},
            headers=auth_headers(tokens["learner"]["token"]))
        assert r.status_code == 200
        assert r.json()["body"] == "TEST post"


# ---------------- LIVE SESSIONS ----------------
class TestLiveSessions:
    def test_upcoming(self, tokens):
        r = requests.get(f"{API}/live-sessions/upcoming", headers=auth_headers(tokens["learner"]["token"]))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert "can_join" in items[0] and "starts_at" in items[0]

    def test_join_mocked(self, tokens):
        items = requests.get(f"{API}/live-sessions/upcoming",
            headers=auth_headers(tokens["learner"]["token"])).json()
        sid = items[0]["id"]
        r = requests.post(f"{API}/live-sessions/{sid}/join",
            headers=auth_headers(tokens["learner"]["token"]))
        assert r.status_code == 200
        assert "plugnmeet.example.com" in r.json()["join_url"]
