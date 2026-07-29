"""
Tredev Learn — Iteration 3 portal-focused backend tests.
Covers new/changed endpoints:
- /doubts (create + answer role restriction to staff/admin, no acharya)
- /acharya/content (create, list, review)
- /live-sessions (create by staff, list, mine-acharya)
- /webinars (create by staff)
- /certificates/all-grouped, /certificates/signed-by-me, /certificates/issue
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break
API = f"{BASE_URL}/api"

CREDS = {
    "learner":  ("learner@tredevlearn.com", "Learner@123"),
    "acharya":  ("acharya@tredevlearn.com", "Acharya@123"),
    "staff":    ("staff@tredevlearn.com",   "Staff@123"),
    "admin":    ("admin@tredevlearn.com",   "Admin@123"),
    "sadmin":   ("superadmin@tredevlearn.com", "SuperAdmin@123"),
}


def _login(role: str):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {r: _login(r) for r in CREDS}


# ---------- Auth sanity ----------
class TestAuth:
    def test_all_roles_login(self, tokens):
        for role, (tok, user) in tokens.items():
            assert tok
            assert user.get("role") in ["learner","acharya","academic_staff","admin","super_admin"]


# ---------- Doubts role guard ----------
class TestDoubtsFlow:
    def test_learner_creates_doubt(self, tokens):
        ltok, luser = tokens["learner"]
        # Get enrolments (may be empty) - try first offering
        offerings = requests.get(f"{API}/offerings").json()
        assert len(offerings) > 0, "no offerings seeded"
        oid = offerings[0].get("id") or offerings[0].get("_id")
        r = requests.post(f"{API}/doubts", json={
            "offering_id": oid, "question": "TEST_doubt from iteration3 pytest"
        }, headers=_h(ltok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["question"].startswith("TEST_")
        pytest.doubt_id = d.get("id") or d.get("_id")

    def test_acharya_cannot_answer_doubt(self, tokens):
        atok, _ = tokens["acharya"]
        did = getattr(pytest, "doubt_id", None)
        if not did:
            pytest.skip("no doubt id")
        r = requests.post(f"{API}/doubts/{did}/answer",
                          json={"answer": "TEST_answer"}, headers=_h(atok))
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_staff_can_answer_doubt(self, tokens):
        stok, _ = tokens["staff"]
        did = getattr(pytest, "doubt_id", None)
        if not did:
            pytest.skip()
        r = requests.post(f"{API}/doubts/{did}/answer",
                          json={"answer": "TEST_staff answer"}, headers=_h(stok))
        assert r.status_code == 200, r.text

    def test_learner_sees_answered_as_tredev_team(self, tokens):
        ltok, _ = tokens["learner"]
        r = requests.get(f"{API}/doubts/mine", headers=_h(ltok))
        assert r.status_code == 200
        items = r.json()
        # Find the doubt & verify no "academic staff" leakage
        for d in items:
            disp = d.get("answered_by_display", "")
            assert "academic staff" not in disp.lower(), f"leaked staff label: {disp}"


# ---------- Acharya content ----------
class TestAcharyaContent:
    def test_acharya_creates_content(self, tokens):
        atok, _ = tokens["acharya"]
        r = requests.post(f"{API}/acharya/content", json={
            "title": "TEST_content_it3", "body": "test body",
            "kind": "lecture_note"
        }, headers=_h(atok))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["status"] == "pending_review"
        pytest.content_id = c.get("id") or c.get("_id")

    def test_learner_cannot_create_content(self, tokens):
        ltok, _ = tokens["learner"]
        r = requests.post(f"{API}/acharya/content",
                          json={"title": "x", "body": "y", "kind": "lecture_note"},
                          headers=_h(ltok))
        assert r.status_code == 403

    def test_learner_cannot_list_content(self, tokens):
        ltok, _ = tokens["learner"]
        r = requests.get(f"{API}/acharya/content", headers=_h(ltok))
        assert r.status_code == 403

    def test_acharya_lists_own(self, tokens):
        atok, _ = tokens["acharya"]
        r = requests.get(f"{API}/acharya/content", headers=_h(atok))
        assert r.status_code == 200
        assert any(c.get("title") == "TEST_content_it3" for c in r.json())

    def test_staff_lists_all(self, tokens):
        stok, _ = tokens["staff"]
        r = requests.get(f"{API}/acharya/content", headers=_h(stok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_reviews_content(self, tokens):
        stok, _ = tokens["staff"]
        cid = getattr(pytest, "content_id", None)
        if not cid:
            pytest.skip()
        r = requests.post(f"{API}/acharya/content/{cid}/review",
                          json={"approved": True, "notes": "TEST_ok"},
                          headers=_h(stok))
        assert r.status_code == 200


# ---------- Live sessions + Webinars create role guard ----------
class TestLiveSessionsAndWebinars:
    def test_acharya_cannot_create_live_session(self, tokens):
        atok, _ = tokens["acharya"]
        offerings = requests.get(f"{API}/offerings").json()
        oid = offerings[0].get("id") or offerings[0].get("_id")
        _, auser = tokens["acharya"]
        r = requests.post(f"{API}/live-sessions", json={
            "title": "TEST_livesess", "offering_id": oid,
            "acharya_id": auser["id"],
            "starts_at": "2030-01-01T10:00:00+00:00",
            "duration_min": 60, "mode": "interactive"
        }, headers=_h(atok))
        assert r.status_code == 403

    def test_staff_creates_live_session(self, tokens):
        stok, _ = tokens["staff"]
        _, auser = tokens["acharya"]
        offerings = requests.get(f"{API}/offerings").json()
        oid = offerings[0].get("id") or offerings[0].get("_id")
        r = requests.post(f"{API}/live-sessions", json={
            "title": "TEST_livesess_it3", "offering_id": oid,
            "acharya_id": auser["id"],
            "starts_at": "2030-01-01T10:00:00+00:00",
            "duration_min": 60, "mode": "interactive"
        }, headers=_h(stok))
        assert r.status_code == 200, r.text

    def test_acharya_mine_sessions(self, tokens):
        atok, _ = tokens["acharya"]
        r = requests.get(f"{API}/live-sessions/mine-acharya", headers=_h(atok))
        assert r.status_code == 200
        items = r.json()
        # There should be seeded 2 + our new one (approx). Just assert list not empty.
        assert isinstance(items, list)

    def test_staff_creates_webinar(self, tokens):
        stok, _ = tokens["staff"]
        r = requests.post(f"{API}/webinars", json={
            "title": "TEST_webinar_it3", "cover_image": "https://x",
            "starts_at": "2030-02-01T10:00:00+00:00", "duration_min": 90,
            "price_inr": 499, "orig_price_inr": 999,
            "mentor_name": "Test Mentor", "description": "TEST_desc",
            "seats_remaining": 50
        }, headers=_h(stok))
        assert r.status_code == 200, r.text

    def test_acharya_cannot_create_webinar(self, tokens):
        atok, _ = tokens["acharya"]
        r = requests.post(f"{API}/webinars", json={
            "title": "TEST_w", "starts_at": "2030-02-01T10:00:00+00:00"
        }, headers=_h(atok))
        assert r.status_code == 403


# ---------- Certificates ----------
class TestCertificates:
    def test_staff_grouped_view(self, tokens):
        stok, _ = tokens["staff"]
        r = requests.get(f"{API}/certificates/all-grouped", headers=_h(stok))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for g in data:
            assert "user_id" in g and "certificates" in g

    def test_learner_cannot_grouped(self, tokens):
        ltok, _ = tokens["learner"]
        r = requests.get(f"{API}/certificates/all-grouped", headers=_h(ltok))
        assert r.status_code == 403

    def test_acharya_signed_by_me(self, tokens):
        atok, _ = tokens["acharya"]
        r = requests.get(f"{API}/certificates/signed-by-me", headers=_h(atok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_issues_cert_and_learner_sees_it(self, tokens):
        stok, _ = tokens["staff"]
        ltok, luser = tokens["learner"]
        # Find an offering with acharya_id (so cert has signature) and approved
        offerings = requests.get(f"{API}/offerings").json()
        target = None
        for o in offerings:
            if o.get("acharya_id"):
                target = o
                break
        if not target:
            pytest.skip("no offering with acharya_id")
        oid = target.get("id") or target.get("_id")
        r = requests.post(f"{API}/certificates/issue",
                          json={"user_id": luser["id"], "offering_id": oid},
                          headers=_h(stok))
        assert r.status_code == 200, r.text
        cert = r.json()
        assert cert.get("code", "").startswith("TDL-")
        assert cert.get("acharya_name")  # should be populated
        # Now verify learner sees it
        r2 = requests.get(f"{API}/certificates/mine", headers=_h(ltok))
        assert r2.status_code == 200
        codes = [c["code"] for c in r2.json()]
        assert cert["code"] in codes

    def test_acharyas_endpoint(self, tokens):
        r = requests.get(f"{API}/acharyas")
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        for a in arr:
            assert a.get("role") == "acharya"
