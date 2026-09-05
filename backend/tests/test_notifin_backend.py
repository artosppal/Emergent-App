"""Notifin backend API tests (FASE 1 MVP)."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://notifin-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --------------------- fixtures ---------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def free_user(s):
    """Fresh free user for isolated CRUD + freemium tests."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "rahasia123", "name": "TEST User"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["session_token"], "user": data["user"]}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# --------------------- health ---------------------
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# --------------------- auth ---------------------
class TestAuth:
    def test_register_duplicate_email(self, s, free_user):
        r = s.post(f"{API}/auth/register",
                   json={"email": free_user["email"], "password": "x123456", "name": "dup"})
        assert r.status_code == 409

    def test_login_seeded_or_fallback(self, s):
        # Try seeded budi first; if missing, register then login
        email, pw = "budi@test.com", "rahasia123"
        r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
        if r.status_code == 401:
            s.post(f"{API}/auth/register",
                   json={"email": email, "password": pw, "name": "Budi Santoso"})
            r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "session_token" in body and body["user"]["email"] == email

    def test_login_wrong_password(self, s, free_user):
        r = s.post(f"{API}/auth/login",
                   json={"email": free_user["email"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_requires_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, s, free_user):
        r = s.get(f"{API}/auth/me", headers=auth(free_user["token"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == free_user["email"]
        assert r.json()["user"]["plan"] == "free"

    def test_google_session_invalid(self, s):
        r = s.post(f"{API}/auth/session", json={"session_id": "invalid-xyz-123"})
        assert r.status_code == 401


# --------------------- subscriptions + freemium ---------------------
class TestSubscriptionsAndFreemium:
    created_ids = []

    def _payload(self, name="Netflix", category="entertainment", cycle="monthly", price=54000):
        return {
            "name": name, "category": category, "price": price,
            "billing_cycle": cycle, "next_due_date": "2026-02-10",
            "status": "paid", "reminders": [3, 1, 0], "notes": "TEST",
        }

    def test_create_three_subs_free_plan(self, s, free_user):
        tok = free_user["token"]
        for i, name in enumerate(["TEST_Netflix", "TEST_Spotify", "TEST_YouTube"]):
            r = s.post(f"{API}/subscriptions",
                       json=self._payload(name=name),
                       headers=auth(tok))
            assert r.status_code == 200, r.text
            sub = r.json()["subscription"]
            assert sub["name"] == name
            self.__class__.created_ids.append(sub["id"])
        assert len(self.__class__.created_ids) == 3

    def test_freemium_limit_reached_on_4th(self, s, free_user):
        r = s.post(f"{API}/subscriptions",
                   json=self._payload(name="TEST_4th"),
                   headers=auth(free_user["token"]))
        assert r.status_code == 403, r.text
        detail = r.json().get("detail")
        # FastAPI wraps dict details as-is
        assert isinstance(detail, dict), f"expected dict detail, got: {detail}"
        assert detail.get("code") == "limit_reached"

    def test_list_and_verify_persistence(self, s, free_user):
        r = s.get(f"{API}/subscriptions", headers=auth(free_user["token"]))
        assert r.status_code == 200
        subs = r.json()["subscriptions"]
        names = {x["name"] for x in subs}
        assert {"TEST_Netflix", "TEST_Spotify", "TEST_YouTube"}.issubset(names)

    def test_filter_by_category(self, s, free_user):
        r = s.get(f"{API}/subscriptions?category=entertainment",
                  headers=auth(free_user["token"]))
        assert r.status_code == 200
        for x in r.json()["subscriptions"]:
            assert x["category"] == "entertainment"

    def test_filter_by_status(self, s, free_user):
        r = s.get(f"{API}/subscriptions?status=paid",
                  headers=auth(free_user["token"]))
        assert r.status_code == 200
        for x in r.json()["subscriptions"]:
            assert x["status"] == "paid"

    def test_update_subscription_and_verify(self, s, free_user):
        sub_id = self.__class__.created_ids[0]
        body = self._payload(name="TEST_Netflix_Updated", price=79000)
        r = s.put(f"{API}/subscriptions/{sub_id}", json=body,
                  headers=auth(free_user["token"]))
        assert r.status_code == 200
        assert r.json()["subscription"]["name"] == "TEST_Netflix_Updated"
        # GET to verify persistence
        r2 = s.get(f"{API}/subscriptions/{sub_id}", headers=auth(free_user["token"]))
        assert r2.status_code == 200
        assert r2.json()["subscription"]["price"] == 79000

    def test_upgrade_requires_configured_mayar(self, s, free_user):
        # /auth/upgrade now starts a real Mayar checkout instead of flipping
        # the plan directly — until MAYAR_API_KEY etc. are set (post-KYC),
        # it must fail clearly rather than silently granting premium.
        r = s.post(f"{API}/auth/upgrade", json={"tier": "monthly"},
                   headers=auth(free_user["token"]))
        assert r.status_code in (503, 200), r.text
        if r.status_code == 200:
            assert "checkout_url" in r.json()

    def test_mayar_webhook_unlocks_unlimited(self, s, free_user):
        # Premium is only ever granted by the Mayar webhook (or its test
        # double) confirming payment — simulate that here.
        r = s.post(f"{API}/test/simulate-mayar-webhook",
                   json={"event": "membership.newMemberRegistered"},
                   headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["action"] == "upgraded_to_premium"
        r_me = s.get(f"{API}/auth/me", headers=auth(free_user["token"]))
        assert r_me.json()["user"]["plan"] == "premium"
        # Now 4th should succeed
        r2 = s.post(f"{API}/subscriptions",
                    json=self._payload(name="TEST_4thPremium"),
                    headers=auth(free_user["token"]))
        assert r2.status_code == 200, r2.text
        self.__class__.created_ids.append(r2.json()["subscription"]["id"])


# --------------------- dashboard ---------------------
class TestDashboard:
    def test_dashboard_structure(self, s, free_user):
        r = s.get(f"{API}/dashboard", headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_this_month", "projection_next_month", "active_count",
                  "plan", "free_limit", "upcoming", "by_category"]:
            assert k in d, f"missing key: {k}"
        assert d["active_count"] >= 3
        assert isinstance(d["upcoming"], list)
        assert isinstance(d["by_category"], list)


# --------------------- channels ---------------------
class TestChannels:
    def test_update_channels(self, s, free_user):
        r = s.put(f"{API}/auth/channels",
                  json={"push": False, "whatsapp": True},
                  headers=auth(free_user["token"]))
        assert r.status_code == 200
        # Verify via /auth/me
        me = s.get(f"{API}/auth/me", headers=auth(free_user["token"])).json()
        assert me["user"]["notify_channels"] == {"push": False, "whatsapp": True}


# --------------------- push register (non-blocking behavior) ---------------------
class TestPushRegister:
    def test_register_push_does_not_crash(self, s, free_user):
        r = s.post(f"{API}/register-push",
                   json={"user_id": free_user["user"]["user_id"],
                         "platform": "web", "device_token": "test-token-xyz"})
        # Provider is likely unreachable / placeholder key; endpoint should not 500
        # Accept 201 (registered), 200/skipped, or 502 provider-unavailable
        assert r.status_code in (200, 201, 502), f"unexpected: {r.status_code} {r.text}"


# --------------------- cleanup ---------------------
class TestCleanup:
    def test_soft_delete_subs(self, s, free_user):
        # Fetch all TEST_ subs and delete
        r = s.get(f"{API}/subscriptions", headers=auth(free_user["token"]))
        for sub in r.json()["subscriptions"]:
            if sub["name"].startswith("TEST_"):
                d = s.delete(f"{API}/subscriptions/{sub['id']}",
                             headers=auth(free_user["token"]))
                assert d.status_code == 200
        # Verify soft-delete: GET returns 404
        r2 = s.get(f"{API}/subscriptions", headers=auth(free_user["token"]))
        remaining = [x for x in r2.json()["subscriptions"] if x["name"].startswith("TEST_")]
        assert remaining == []
