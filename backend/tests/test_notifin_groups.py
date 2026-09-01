"""Notifin FASE 2: Group/Team + dashboard highlights (most_expensive, ending_trials).

Tests share state across classes (invite codes, sub ids, membership). Under the
project's default `-n 2 --dist loadscope` xdist config, classes would otherwise
be split across workers and break the shared state. `xdist_group` pins the
entire module to a single worker so run order is deterministic. Use `-n 0` for
strictly serial runs during debugging.
"""
import os
import uuid
from datetime import date, timedelta
import pytest
import requests

pytestmark = pytest.mark.xdist_group("notifin_groups_module")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://notifin-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --------------------- fixtures ---------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _register(s, prefix="owner"):
    email = f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "rahasia123", "name": f"TEST {prefix}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["session_token"], "user": d["user"]}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def owner(s):
    """Premium owner user"""
    u = _register(s, "owner")
    r = s.post(f"{API}/auth/upgrade", headers=auth(u["token"]))
    assert r.status_code == 200
    assert r.json()["user"]["plan"] == "premium"
    return u


@pytest.fixture(scope="session")
def member(s):
    """Free member user"""
    return _register(s, "member")


@pytest.fixture(scope="session")
def outsider(s):
    """Free user not in the group"""
    return _register(s, "outsider")


@pytest.fixture(scope="session")
def group_ctx(s, owner, member):
    """Create group with owner, member joins, one shared equal sub."""
    # Create group (owner premium)
    r = s.post(f"{API}/groups", json={"name": "TEST_FamCemara"}, headers=auth(owner["token"]))
    assert r.status_code == 200, r.text
    g = r.json()["group"]
    code = g["invite_code"]
    # Member joins with lowercase code -> should still work
    r2 = s.post(f"{API}/groups/join", json={"code": code.lower()},
                headers=auth(member["token"]))
    assert r2.status_code == 200, r2.text
    return {"group_id": g["id"], "invite_code": code, "name": g["name"]}


# --------------------- Group create/premium gating ---------------------
class TestGroupCreate:
    def test_free_user_cannot_create_group(self, s):
        u = _register(s, "free_creator")
        r = s.post(f"{API}/groups", json={"name": "TEST_ShouldFail"},
                   headers=auth(u["token"]))
        assert r.status_code == 403, r.text
        detail = r.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("code") == "premium_required"

    def test_premium_user_creates_group(self, s, owner, group_ctx):
        # group_ctx already created a group via owner
        assert len(group_ctx["invite_code"]) == 6
        assert group_ctx["invite_code"].isalnum()


# --------------------- Join ---------------------
class TestGroupJoin:
    def test_join_invalid_code_404(self, s, member):
        r = s.post(f"{API}/groups/join", json={"code": "ZZZZZZ"},
                   headers=auth(member["token"]))
        assert r.status_code == 404

    def test_join_already_member_409(self, s, member, group_ctx):
        r = s.post(f"{API}/groups/join", json={"code": group_ctx["invite_code"]},
                   headers=auth(member["token"]))
        assert r.status_code == 409

    def test_join_case_insensitive_ok(self, s, outsider, group_ctx):
        # outsider joins using lowercase — should convert internally
        r = s.post(f"{API}/groups/join",
                   json={"code": group_ctx["invite_code"].lower()},
                   headers=auth(outsider["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "joined"
        assert body["group_id"] == group_ctx["group_id"]


# --------------------- List / Detail ---------------------
class TestGroupListDetail:
    def test_list_groups_shape(self, s, owner, group_ctx):
        r = s.get(f"{API}/groups", headers=auth(owner["token"]))
        assert r.status_code == 200
        gs = r.json()["groups"]
        mine = next((g for g in gs if g["id"] == group_ctx["group_id"]), None)
        assert mine is not None
        for k in ("member_count", "sub_count", "my_share", "invite_code", "is_owner"):
            assert k in mine
        assert mine["is_owner"] is True
        assert mine["member_count"] >= 3  # owner + member + outsider

    def test_detail_before_subs(self, s, owner, group_ctx):
        r = s.get(f"{API}/groups/{group_ctx['group_id']}", headers=auth(owner["token"]))
        assert r.status_code == 200
        g = r.json()["group"]
        assert g["is_owner"] is True
        assert isinstance(g["members"], list)
        assert isinstance(g["subscriptions"], list)
        assert "unpaid_members" in g
        assert "my_total" in g


# --------------------- Group Subscriptions CRUD ---------------------
class TestGroupSubsCRUD:
    """Class-scoped state: created sub id."""
    _sub_id = None

    def _payload(self, split_type="equal", custom=None, price=180000):
        # Use a future due date well within horizon so advance_group_sub keeps it stable.
        # Note: container system date ~2026-09-01 per main agent note.
        due = (date.today() + timedelta(days=20)).isoformat()
        p = {
            "name": "TEST_GroupNetflix",
            "category": "entertainment",
            "price": price,
            "billing_cycle": "monthly",
            "next_due_date": due,
            "split_type": split_type,
        }
        if custom is not None:
            p["custom_splits"] = custom
        return p

    def test_member_cannot_create_sub(self, s, member, group_ctx):
        r = s.post(f"{API}/groups/{group_ctx['group_id']}/subscriptions",
                   json=self._payload(),
                   headers=auth(member["token"]))
        assert r.status_code == 403

    def test_owner_creates_equal_sub(self, s, owner, group_ctx):
        r = s.post(f"{API}/groups/{group_ctx['group_id']}/subscriptions",
                   json=self._payload(),
                   headers=auth(owner["token"]))
        assert r.status_code == 200, r.text
        sub = r.json()["subscription"]
        assert sub["split_type"] == "equal"
        TestGroupSubsCRUD._sub_id = sub["id"]

    def test_detail_shows_splits_equal(self, s, owner, group_ctx):
        r = s.get(f"{API}/groups/{group_ctx['group_id']}", headers=auth(owner["token"]))
        assert r.status_code == 200
        g = r.json()["group"]
        target = next((x for x in g["subscriptions"]
                       if x["id"] == TestGroupSubsCRUD._sub_id), None)
        assert target is not None
        splits = target["splits"]
        # 3 members -> 180000/3 = 60000 each
        assert len(splits) == 3
        for sp in splits:
            assert sp["amount"] == 60000
            assert sp["paid"] is False

    def test_owner_updates_to_custom_split(self, s, owner, group_ctx, member, outsider):
        cs = {
            owner["user"]["user_id"]: 100000,
            member["user"]["user_id"]: 50000,
            outsider["user"]["user_id"]: 30000,
        }
        r = s.put(
            f"{API}/groups/{group_ctx['group_id']}/subscriptions/{TestGroupSubsCRUD._sub_id}",
            json=self._payload(split_type="custom", custom=cs, price=180000),
            headers=auth(owner["token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["subscription"]["split_type"] == "custom"
        # GET verify
        r2 = s.get(f"{API}/groups/{group_ctx['group_id']}", headers=auth(owner["token"]))
        target = next((x for x in r2.json()["group"]["subscriptions"]
                       if x["id"] == TestGroupSubsCRUD._sub_id), None)
        amounts = {sp["user_id"]: sp["amount"] for sp in target["splits"]}
        assert amounts[owner["user"]["user_id"]] == 100000
        assert amounts[member["user"]["user_id"]] == 50000
        assert amounts[outsider["user"]["user_id"]] == 30000


# --------------------- Pay flow ---------------------
class TestPayFlow:
    def test_member_pays_self(self, s, member, group_ctx):
        sid = TestGroupSubsCRUD._sub_id
        r = s.put(f"{API}/groups/{group_ctx['group_id']}/subscriptions/{sid}/pay",
                  json={"paid": True},
                  headers=auth(member["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["paid"] is True
        # Verify via detail: member's my_paid = True
        r2 = s.get(f"{API}/groups/{group_ctx['group_id']}", headers=auth(member["token"]))
        target = next(x for x in r2.json()["group"]["subscriptions"] if x["id"] == sid)
        assert target["my_paid"] is True

    def test_member_cannot_pay_others(self, s, member, outsider, group_ctx):
        sid = TestGroupSubsCRUD._sub_id
        r = s.put(f"{API}/groups/{group_ctx['group_id']}/subscriptions/{sid}/pay",
                  json={"user_id": outsider["user"]["user_id"], "paid": True},
                  headers=auth(member["token"]))
        assert r.status_code == 403

    def test_owner_marks_outsider_paid(self, s, owner, outsider, group_ctx):
        sid = TestGroupSubsCRUD._sub_id
        r = s.put(f"{API}/groups/{group_ctx['group_id']}/subscriptions/{sid}/pay",
                  json={"user_id": outsider["user"]["user_id"], "paid": True},
                  headers=auth(owner["token"]))
        assert r.status_code == 200
        # Verify: unpaid_members should now be empty (owner also mark self)
        s.put(f"{API}/groups/{group_ctx['group_id']}/subscriptions/{sid}/pay",
              json={"paid": True}, headers=auth(owner["token"]))
        r2 = s.get(f"{API}/groups/{group_ctx['group_id']}", headers=auth(owner["token"]))
        assert r2.json()["group"]["unpaid_members"] == []


# --------------------- Leave / Delete ---------------------
class TestLeaveDelete:
    def test_owner_cannot_leave(self, s, owner, group_ctx):
        r = s.post(f"{API}/groups/{group_ctx['group_id']}/leave",
                   headers=auth(owner["token"]))
        assert r.status_code == 400

    def test_member_can_leave(self, s, outsider, group_ctx):
        # outsider leaves the group
        r = s.post(f"{API}/groups/{group_ctx['group_id']}/leave",
                   headers=auth(outsider["token"]))
        assert r.status_code == 200
        # verify: GET detail with outsider now 403 (not member)
        r2 = s.get(f"{API}/groups/{group_ctx['group_id']}",
                   headers=auth(outsider["token"]))
        assert r2.status_code == 403

    def test_non_owner_cannot_delete(self, s, member, group_ctx):
        r = s.delete(f"{API}/groups/{group_ctx['group_id']}",
                     headers=auth(member["token"]))
        assert r.status_code == 403

    def test_owner_deletes_group(self, s, owner, group_ctx):
        r = s.delete(f"{API}/groups/{group_ctx['group_id']}",
                     headers=auth(owner["token"]))
        assert r.status_code == 200
        # After delete, GET detail returns 404
        r2 = s.get(f"{API}/groups/{group_ctx['group_id']}",
                   headers=auth(owner["token"]))
        assert r2.status_code == 404


# --------------------- Dashboard highlights (most_expensive + ending_trials) ---------------------
class TestDashboardHighlights:
    def test_dashboard_highlights(self, s):
        # Fresh premium user (unlimited) with 2 subs: cheap yearly + expensive monthly + trial
        u = _register(s, "dashuser")
        s.post(f"{API}/auth/upgrade", headers=auth(u["token"]))
        today = date.today()

        # Cheap monthly
        s.post(f"{API}/subscriptions", json={
            "name": "TEST_Cheap", "category": "music", "price": 50000,
            "billing_cycle": "monthly",
            "next_due_date": (today + timedelta(days=5)).isoformat(),
            "status": "paid", "reminders": [3, 1, 0],
        }, headers=auth(u["token"]))

        # Expensive yearly -> monthly-normalized should be 1200000/12=100000
        s.post(f"{API}/subscriptions", json={
            "name": "TEST_Expensive_Yearly", "category": "productivity", "price": 1200000,
            "billing_cycle": "yearly",
            "next_due_date": (today + timedelta(days=30)).isoformat(),
            "status": "paid", "reminders": [3, 1, 0],
        }, headers=auth(u["token"]))

        # Trial ending in 5 days -> should appear in ending_trials
        s.post(f"{API}/subscriptions", json={
            "name": "TEST_TrialSoon", "category": "productivity", "price": 0,
            "billing_cycle": "monthly",
            "next_due_date": (today + timedelta(days=5)).isoformat(),
            "status": "trial", "reminders": [3, 1, 0],
        }, headers=auth(u["token"]))

        # Trial 20 days out — should NOT appear
        s.post(f"{API}/subscriptions", json={
            "name": "TEST_TrialFar", "category": "productivity", "price": 0,
            "billing_cycle": "monthly",
            "next_due_date": (today + timedelta(days=20)).isoformat(),
            "status": "trial", "reminders": [3, 1, 0],
        }, headers=auth(u["token"]))

        r = s.get(f"{API}/dashboard", headers=auth(u["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "most_expensive" in d
        assert "ending_trials" in d
        me = d["most_expensive"]
        assert me is not None
        assert me["name"] == "TEST_Expensive_Yearly"
        assert me["monthly_cost"] == 100000
        et_names = {t["name"] for t in d["ending_trials"]}
        assert "TEST_TrialSoon" in et_names
        assert "TEST_TrialFar" not in et_names
        # days_left must not be negative
        for t in d["ending_trials"]:
            assert t["days_left"] >= 0
            assert t["days_left"] <= 14
