"""
Tredev Learn — Iteration 2 new-feature backend tests.
Covers: /blogs, /webinars, /mentors, /testimonials, /stats,
/calculators/tarot, /calculators/ram-shalaka.
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


class TestBlogs:
    def test_list_blogs_returns_5(self):
        r = requests.get(f"{API}/blogs", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5, f"expected >=5 blogs got {len(items)}"
        for b in items:
            assert "slug" in b and "title" in b and "category" in b
            assert "_id" not in b  # mongo _id must be excluded

    def test_categories_present(self):
        items = requests.get(f"{API}/blogs").json()
        cats = {b["category"] for b in items}
        # Expected categories per problem statement
        expected = {"palmistry", "tarot", "vastu", "gita", "panchang"}
        assert expected.issubset(cats), f"missing cats: {expected - cats}"

    def test_filter_by_category(self):
        r = requests.get(f"{API}/blogs", params={"category": "gita"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(b["category"] == "gita" for b in items)

    def test_get_blog_by_slug_full_body(self):
        items = requests.get(f"{API}/blogs").json()
        # find palmistry (any slug — problem statement mentioned read-your-palm)
        palm = next((b for b in items if b["category"] == "palmistry"), None)
        assert palm is not None
        r = requests.get(f"{API}/blogs/{palm['slug']}")
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == palm["slug"]
        assert d.get("body") or d.get("content"), "expected full body content"

    def test_get_blog_not_found(self):
        r = requests.get(f"{API}/blogs/does-not-exist-xyz")
        assert r.status_code == 404


class TestWebinars:
    def test_list_webinars(self):
        r = requests.get(f"{API}/webinars", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5, f"expected >=5 webinars, got {len(items)}"
        for w in items:
            assert "starts_in_seconds" in w
            assert "is_live" in w
            assert isinstance(w["is_live"], bool)
            assert "_id" not in w

    def test_sorted_ascending(self):
        items = requests.get(f"{API}/webinars").json()
        starts = [w["starts_at"] for w in items]
        assert starts == sorted(starts), "webinars must be sorted by starts_at ascending"


class TestMentors:
    def test_list_mentors(self):
        r = requests.get(f"{API}/mentors")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 8, f"expected >=8 mentors, got {len(items)}"
        for m in items:
            for k in ["name", "title", "parampara", "bio", "avatar"]:
                assert k in m, f"mentor missing {k}: keys={list(m.keys())}"
            assert "_id" not in m

    def test_sorted_by_order(self):
        items = requests.get(f"{API}/mentors").json()
        orders = [m.get("order", 0) for m in items]
        assert orders == sorted(orders), f"mentors not sorted by order: {orders}"


class TestTestimonials:
    def test_list_testimonials(self):
        r = requests.get(f"{API}/testimonials")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 6, f"expected >=6 testimonials, got {len(items)}"
        for t in items:
            for k in ["name", "role", "rating", "avatar", "quote"]:
                assert k in t, f"testimonial missing {k}"
            assert 1 <= t["rating"] <= 5


class TestStats:
    def test_stats(self):
        r = requests.get(f"{API}/stats")
        assert r.status_code == 200
        d = r.json()
        assert d["learners_display"] >= 620000
        assert d["paths_display"] >= 60
        assert d["google_rating"] == 4.8
        assert d["mentors_display"] >= 30
        assert d["years_of_legacy"] == 51
        assert "verses_indexed" in d
        assert "certificates_issued" in d


class TestTarot:
    def test_tarot_spread(self):
        r = requests.post(f"{API}/calculators/tarot", json={"question": "How to progress?"})
        assert r.status_code == 200
        d = r.json()
        assert len(d["spread"]) == 3
        positions = [c["position"] for c in d["spread"]]
        assert positions == ["Past", "Present", "Future"]
        for c in d["spread"]:
            assert "name" in c and "meaning" in c
            assert isinstance(c["reversed"], bool)
        assert d.get("note")

    def test_tarot_empty_question_ok(self):
        # not required — accepts empty question
        r = requests.post(f"{API}/calculators/tarot", json={"question": ""})
        assert r.status_code == 200
        assert len(r.json()["spread"]) == 3

    def test_tarot_deterministic_same_question(self):
        r1 = requests.post(f"{API}/calculators/tarot", json={"question": "TEST determinism"}).json()
        r2 = requests.post(f"{API}/calculators/tarot", json={"question": "TEST determinism"}).json()
        assert [c["name"] for c in r1["spread"]] == [c["name"] for c in r2["spread"]]


class TestRamShalaka:
    def test_ram_shalaka_answers(self):
        r = requests.post(f"{API}/calculators/ram-shalaka", json={"question": "Will my sadhana bear fruit?"})
        assert r.status_code == 200
        d = r.json()
        assert d.get("answer")
        assert d.get("note")

    def test_ram_shalaka_empty_rejects(self):
        r = requests.post(f"{API}/calculators/ram-shalaka", json={"question": ""})
        assert r.status_code == 400

    def test_ram_shalaka_missing_field(self):
        r = requests.post(f"{API}/calculators/ram-shalaka", json={})
        assert r.status_code == 400
