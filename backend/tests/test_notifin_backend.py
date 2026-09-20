"""Notifin backend API tests (FASE 1 MVP)."""
import os
import uuid
from datetime import date, timedelta
import pytest
import requests

# Several classes share cross-class state via the session-scoped free_user
# fixture (e.g. TestSubscriptionsAndFreemium creates subs that TestDashboard
# and TestCleanup then read back). Under the project's --dist loadgroup,
# xdist_group pins every test in this module to one worker so that sharing
# is safe — without it, classes can land on different workers, each with
# its own copy of "session"-scoped fixtures, and the dependent assertions
# fail nondeterministically depending on the split (see pytest.ini).
pytestmark = pytest.mark.xdist_group("notifin_backend_module")

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
    data = register_verified(s, email, "rahasia123", "TEST User")
    return {"email": email, "token": data["session_token"], "user": data["user"]}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register_verified(s, email, password, name, referral_code=None):
    """Full register -> verify flow. Registration is OTP-gated (see
    docs/email-otp.md); in local/simulation mode (no RESEND_API_KEY) the
    backend echoes the code as `dev_code` on the /auth/register response
    specifically so tests and local dev can complete the flow."""
    body = {"email": email, "password": password, "name": name}
    if referral_code:
        body["referral_code"] = referral_code
    r = s.post(f"{API}/auth/register", json=body)
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r = s.post(f"{API}/auth/register/verify", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return r.json()


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
            register_verified(s, email, pw, "Budi Santoso")
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
        # Direct PKCE flow (see PROMPT.md architecture note) — body is an
        # authorization code + redirect_uri, not a proxied session_id.
        r = s.post(f"{API}/auth/session",
                   json={"code": "invalid-xyz-123", "redirect_uri": "https://example.com/callback"})
        # 401 when Google OAuth is configured and rejects the code; 503 when
        # GOOGLE_CLIENT_ID/SECRET are unset locally (see PROMPT.md env table).
        assert r.status_code in (401, 503), f"unexpected: {r.status_code} {r.text}"


# --------------------- change / forgot / reset password ---------------------
class TestPassword:
    def test_change_password_wrong_current_401(self, s):
        u = register_verified(s, f"test_chpw_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST ChPw")
        r = s.put(f"{API}/auth/password",
                  json={"current_password": "nope", "new_password": "newpass123"},
                  headers=auth(u["session_token"]))
        assert r.status_code == 401

    def test_change_password_success_and_relogin(self, s):
        email = f"test_chpw_{uuid.uuid4().hex[:8]}@example.com"
        u = register_verified(s, email, "rahasia123", "TEST ChPw")
        r = s.put(f"{API}/auth/password",
                  json={"current_password": "rahasia123", "new_password": "newpass123"},
                  headers=auth(u["session_token"]))
        assert r.status_code == 200, r.text

        r_old = s.post(f"{API}/auth/login", json={"email": email, "password": "rahasia123"})
        assert r_old.status_code == 401

        r_new = s.post(f"{API}/auth/login", json={"email": email, "password": "newpass123"})
        assert r_new.status_code == 200, r_new.text

    def test_change_password_too_short_422(self, s):
        u = register_verified(s, f"test_chpw_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST ChPw")
        r = s.put(f"{API}/auth/password",
                  json={"current_password": "rahasia123", "new_password": "abc"},
                  headers=auth(u["session_token"]))
        assert r.status_code == 422

    def test_forgot_password_unknown_email_is_silent(self, s):
        r = s.post(f"{API}/auth/forgot-password", json={"email": "nobody_xyz@example.com"})
        assert r.status_code == 200, r.text
        assert "dev_code" not in r.json()

    def test_forgot_and_reset_password_flow(self, s):
        email = f"test_reset_{uuid.uuid4().hex[:8]}@example.com"
        register_verified(s, email, "rahasia123", "TEST Reset")

        r = s.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200, r.text
        code = r.json()["dev_code"]

        r2 = s.post(f"{API}/auth/reset-password",
                    json={"email": email, "code": code, "new_password": "resetpass123"})
        assert r2.status_code == 200, r2.text
        assert "session_token" in r2.json()

        r_old = s.post(f"{API}/auth/login", json={"email": email, "password": "rahasia123"})
        assert r_old.status_code == 401
        r_new = s.post(f"{API}/auth/login", json={"email": email, "password": "resetpass123"})
        assert r_new.status_code == 200, r_new.text

    def test_reset_password_wrong_code_400(self, s):
        email = f"test_reset_{uuid.uuid4().hex[:8]}@example.com"
        register_verified(s, email, "rahasia123", "TEST Reset")
        s.post(f"{API}/auth/forgot-password", json={"email": email})
        r = s.post(f"{API}/auth/reset-password",
                   json={"email": email, "code": "000000", "new_password": "resetpass123"})
        assert r.status_code == 400


# --------------------- subscriptions + freemium ---------------------
class TestSubscriptionsAndFreemium:
    created_ids = []

    def _payload(self, name="Netflix", category="entertainment", cycle="monthly", price=54000):
        return {
            "name": name, "category": category, "price": price,
            "billing_cycle": cycle, "next_due_date": "2026-02-10",
            "status": "paid", "reminders": [3, 1, 0], "notes": "TEST",
        }

    def test_create_five_subs_free_plan(self, s, free_user):
        tok = free_user["token"]
        names = ["TEST_Netflix", "TEST_Spotify", "TEST_YouTube", "TEST_Disney", "TEST_HBO"]
        for name in names:
            r = s.post(f"{API}/subscriptions",
                       json=self._payload(name=name),
                       headers=auth(tok))
            assert r.status_code == 200, r.text
            sub = r.json()["subscription"]
            assert sub["name"] == name
            self.__class__.created_ids.append(sub["id"])
        assert len(self.__class__.created_ids) == 5

    def test_freemium_limit_reached_on_6th(self, s, free_user):
        r = s.post(f"{API}/subscriptions",
                   json=self._payload(name="TEST_6th"),
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
        # it must fail clearly rather than silently granting premium. It also
        # requires a verified phone (see server.py:upgrade) — go through that
        # flow first so this actually reaches the Mayar-config check.
        phone = f"0812{str(uuid.uuid4().int)[-8:]}"
        r = s.post(f"{API}/auth/phone/verify/request",
                   json={"phone": phone}, headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text
        code = r.json()["dev_code"]
        r = s.post(f"{API}/auth/phone/verify/confirm",
                   json={"code": code}, headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text

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
        # Now a 6th (past the free limit) should succeed
        r2 = s.post(f"{API}/subscriptions",
                    json=self._payload(name="TEST_6thPremium"),
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


# --------------------- monthly summary (Premium) ---------------------
class TestMonthlySummary:
    def test_no_snapshot_yet_returns_not_sent(self, s):
        u = register_verified(s, f"test_sum_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Sum")
        r = s.post(f"{API}/test/simulate-monthly-summary", json={"period": "2020-01"},
                   headers=auth(u["session_token"]))
        assert r.status_code == 200, r.text
        assert r.json()["sent"] is False

    def test_sends_for_period_with_a_snapshot(self, s):
        u = register_verified(s, f"test_sum_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Sum")
        tok = u["session_token"]
        # /dashboard writes a spending_snapshots row for the CURRENT period
        # as a side effect (see server.py:dashboard) — use that instead of
        # needing direct DB access from the test.
        r = s.get(f"{API}/dashboard", headers=auth(tok))
        assert r.status_code == 200, r.text
        current_period = date.today().strftime("%Y-%m")

        r2 = s.post(f"{API}/test/simulate-monthly-summary", json={"period": current_period},
                    headers=auth(tok))
        assert r2.status_code == 200, r2.text
        assert r2.json() == {"sent": True, "period": current_period}

    def test_default_period_is_previous_month(self, s):
        u = register_verified(s, f"test_sum_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Sum")
        r = s.post(f"{API}/test/simulate-monthly-summary", json={}, headers=auth(u["session_token"]))
        assert r.status_code == 200, r.text
        prev = (date.today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
        assert r.json()["period"] == prev


# --------------------- referral program ---------------------
class TestReferral:
    def test_new_user_has_referral_code(self, s):
        u = register_verified(s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Ref")
        r = s.get(f"{API}/referral/me", headers=auth(u["session_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["referral_code"] and len(body["referral_code"]) == 6
        assert body["completed_count"] == 0
        assert body["referrals"] == []

    def test_unknown_referral_code_does_not_block_registration(self, s):
        u = register_verified(
            s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Ref",
            referral_code="ZZZZZZ")
        assert "session_token" in u

    def test_referral_links_as_pending(self, s):
        referrer = register_verified(s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Referrer")
        code = referrer["user"]["referral_code"]
        referee_name = f"TEST Referee {uuid.uuid4().hex[:6]}"
        register_verified(s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", referee_name,
                          referral_code=code)

        r = s.get(f"{API}/referral/me", headers=auth(referrer["session_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["completed_count"] == 0
        assert any(x["name"] == referee_name and x["status"] == "pending" for x in body["referrals"])

    def test_referral_reward_granted_when_referee_upgrades(self, s):
        referrer = register_verified(s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Referrer")
        code = referrer["user"]["referral_code"]
        referee = register_verified(s, f"test_ref_{uuid.uuid4().hex[:8]}@example.com", "rahasia123", "TEST Referee",
                                    referral_code=code)
        assert referrer["user"]["plan"] == "free"

        r = s.post(f"{API}/test/simulate-mayar-webhook",
                   json={"event": "membership.newMemberRegistered"},
                   headers=auth(referee["session_token"]))
        assert r.status_code == 200, r.text

        me = s.get(f"{API}/auth/me", headers=auth(referrer["session_token"])).json()
        assert me["user"]["plan"] == "premium"
        assert me["user"]["premium_expires_at"]

        r2 = s.get(f"{API}/referral/me", headers=auth(referrer["session_token"]))
        assert r2.json()["completed_count"] == 1


# --------------------- channels ---------------------
class TestChannels:
    def test_update_channels(self, s, free_user):
        # Enabling the whatsapp channel requires a verified phone number
        # first (see server.py:update_channels) — go through that flow.
        phone = f"0812{str(uuid.uuid4().int)[-8:]}"
        r = s.post(f"{API}/auth/phone/verify/request",
                   json={"phone": phone}, headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text
        code = r.json()["dev_code"]
        r = s.post(f"{API}/auth/phone/verify/confirm",
                   json={"code": code}, headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text

        r = s.put(f"{API}/auth/channels",
                  json={"push": False, "whatsapp": True},
                  headers=auth(free_user["token"]))
        assert r.status_code == 200, r.text
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
