"""Notifin FASE 3: WhatsApp (Fonnte simulation) + phone + nudge + history + reminder_sweep.

Runs strictly serial-safe (uses fresh users per class). Pinned to the same
xdist group as FASE 2 tests so no cross-worker races.
"""
import os
import sys
import uuid
import asyncio
from datetime import date, datetime, timedelta, timezone
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

# Access the running server's reminder_sweep for direct integration test.
sys.path.insert(0, "/app/backend")
import server as srv  # type: ignore
from server import reminder_sweep  # type: ignore


def _fresh_db():
    """Fresh Motor client bound to the current event loop (avoid loop mismatch)."""
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]

pytestmark = pytest.mark.xdist_group("notifin_fase3_module")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://notifin-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --------------------- helpers ---------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register(s, prefix="u"):
    email = f"test_f3_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "rahasia123",
                     "name": f"TEST_F3_{prefix}"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["session_token"], "user": d["user"]}


def _upgrade(s, u):
    r = s.post(f"{API}/auth/upgrade", headers=auth(u["token"]))
    assert r.status_code == 200
    u["user"] = r.json()["user"]
    return u


# --------------------- Phone normalization ---------------------
class TestPhoneEndpoint:
    def test_normalize_08xx_to_62(self, s):
        u = _register(s, "phone_a")
        r = s.put(f"{API}/auth/phone", json={"phone": "0812-3456-7890"},
                  headers=auth(u["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["phone"] == "6281234567890"
        assert body["user"]["wa_live"] is False
        # GET /auth/me confirms persistence
        r2 = s.get(f"{API}/auth/me", headers=auth(u["token"]))
        assert r2.json()["user"]["phone"] == "6281234567890"

    def test_normalize_plus62_ok(self, s):
        u = _register(s, "phone_b")
        r = s.put(f"{API}/auth/phone", json={"phone": "+62 812 9999 1111"},
                  headers=auth(u["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["user"]["phone"] == "6281299991111"

    def test_invalid_phone_422(self, s):
        u = _register(s, "phone_c")
        r = s.put(f"{API}/auth/phone", json={"phone": "123"},
                  headers=auth(u["token"]))
        assert r.status_code == 422

    def test_empty_clears_phone(self, s):
        u = _register(s, "phone_d")
        # set
        s.put(f"{API}/auth/phone", json={"phone": "081298765432"}, headers=auth(u["token"]))
        # clear
        r = s.put(f"{API}/auth/phone", json={"phone": ""}, headers=auth(u["token"]))
        assert r.status_code == 200
        assert r.json()["user"]["phone"] in (None, "")
        r2 = s.get(f"{API}/auth/me", headers=auth(u["token"]))
        assert r2.json()["user"]["phone"] in (None, "")

    def test_public_user_has_wa_live_field(self, s):
        u = _register(s, "phone_e")
        r = s.get(f"{API}/auth/me", headers=auth(u["token"]))
        assert r.status_code == 200
        pu = r.json()["user"]
        assert "wa_live" in pu
        assert pu["wa_live"] is False  # FONNTE_TOKEN empty in preview


# --------------------- Nudge endpoint ---------------------
@pytest.fixture(scope="class")
def nudge_ctx(request):
    """Owner + member group with an unpaid group sub."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    owner = _register(session, "owner_n")
    _upgrade(session, owner)
    member = _register(session, "member_n")
    # give member a phone -> nudge should include whatsapp channel simulated
    session.put(f"{API}/auth/phone", json={"phone": "081234567891"},
                headers=auth(member["token"]))

    r = session.post(f"{API}/groups", json={"name": "TEST_F3_NudgeGroup"},
                     headers=auth(owner["token"]))
    assert r.status_code == 200
    g = r.json()["group"]
    session.post(f"{API}/groups/join", json={"code": g["invite_code"]},
                 headers=auth(member["token"]))

    due = (date.today() + timedelta(days=20)).isoformat()
    r2 = session.post(f"{API}/groups/{g['id']}/subscriptions",
                      json={"name": "TEST_F3_Netflix", "category": "entertainment",
                            "price": 200000, "billing_cycle": "monthly",
                            "next_due_date": due, "split_type": "equal"},
                      headers=auth(owner["token"]))
    assert r2.status_code == 200
    sub = r2.json()["subscription"]
    return {"session": session, "owner": owner, "member": member,
            "gid": g["id"], "sid": sub["id"]}


class TestNudge:
    def test_owner_nudges_unpaid_member_ok(self, nudge_ctx):
        s = nudge_ctx["session"]
        r = s.post(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/nudge",
            json={"user_id": nudge_ctx["member"]["user"]["user_id"]},
            headers=auth(nudge_ctx["owner"]["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "sent"
        assert body["wa_simulated"] is True
        # member had phone set -> whatsapp channel present
        assert "whatsapp" in body["channels"]

    def test_repeat_same_day_429(self, nudge_ctx):
        s = nudge_ctx["session"]
        r = s.post(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/nudge",
            json={"user_id": nudge_ctx["member"]["user"]["user_id"]},
            headers=auth(nudge_ctx["owner"]["token"]))
        assert r.status_code == 429

    def test_wa_outbox_persisted(self, nudge_ctx):
        # verify a simulated wa_outbox record exists for member phone
        async def _check():
            _c, _db = _fresh_db()
            try:
                return await _db.wa_outbox.find_one(
                    {"phone": "6281234567891", "status": "simulated"}, {"_id": 0})
            finally:
                _c.close()
        rec = asyncio.run(_check())
        assert rec is not None
        assert rec.get("simulated") is True
        assert "belum dibayar" in rec.get("message", "").lower() \
            or "mengingatkan" in rec.get("message", "").lower()

    def test_nudge_self_400(self, nudge_ctx):
        s = nudge_ctx["session"]
        r = s.post(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/nudge",
            json={"user_id": nudge_ctx["owner"]["user"]["user_id"]},
            headers=auth(nudge_ctx["owner"]["token"]))
        assert r.status_code == 400

    def test_non_owner_403(self, nudge_ctx):
        s = nudge_ctx["session"]
        r = s.post(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/nudge",
            json={"user_id": nudge_ctx["owner"]["user"]["user_id"]},
            headers=auth(nudge_ctx["member"]["token"]))
        assert r.status_code == 403

    def test_nudge_already_paid_400(self, nudge_ctx):
        s = nudge_ctx["session"]
        # mark member paid
        r0 = s.put(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/pay",
            json={"user_id": nudge_ctx["member"]["user"]["user_id"], "paid": True},
            headers=auth(nudge_ctx["owner"]["token"]))
        assert r0.status_code == 200
        # need to bypass rate limit — create fresh member for clean test
        member2 = _register(s, "member_paid")
        s.post(f"{API}/groups/join",
               json={"code": (s.get(f"{API}/groups/{nudge_ctx['gid']}",
                                    headers=auth(nudge_ctx['owner']['token']))
                              .json()["group"]["invite_code"])},
               headers=auth(member2["token"]))
        # mark them paid too
        s.put(f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/pay",
              json={"user_id": member2["user"]["user_id"], "paid": True},
              headers=auth(nudge_ctx["owner"]["token"]))
        r = s.post(
            f"{API}/groups/{nudge_ctx['gid']}/subscriptions/{nudge_ctx['sid']}/nudge",
            json={"user_id": member2["user"]["user_id"]},
            headers=auth(nudge_ctx["owner"]["token"]))
        assert r.status_code == 400


# --------------------- Group history ---------------------
class TestGroupHistory:
    def test_new_sub_empty_history(self, s):
        owner = _upgrade(s, _register(s, "hist_o1"))
        r = s.post(f"{API}/groups", json={"name": "TEST_F3_HistNew"},
                   headers=auth(owner["token"]))
        g = r.json()["group"]
        due = (date.today() + timedelta(days=15)).isoformat()
        s.post(f"{API}/groups/{g['id']}/subscriptions",
               json={"name": "TEST_F3_NewSub", "category": "entertainment",
                     "price": 60000, "billing_cycle": "monthly",
                     "next_due_date": due, "split_type": "equal"},
               headers=auth(owner["token"]))
        # first cycle back = today-ish; created_at is now → cycle_back < created → skip
        r2 = s.get(f"{API}/groups/{g['id']}/history", headers=auth(owner["token"]))
        assert r2.status_code == 200
        # Either empty history[] or an entry with empty periods filtered out
        hist = r2.json()["history"]
        assert isinstance(hist, list)
        # New sub — no periods should appear
        for h in hist:
            assert h["periods"] == []

    def test_past_periods_after_backdate(self, s):
        owner = _upgrade(s, _register(s, "hist_o2"))
        r = s.post(f"{API}/groups", json={"name": "TEST_F3_HistOld"},
                   headers=auth(owner["token"]))
        g = r.json()["group"]
        # Create sub with a past due date (100 days ago)
        past = (date.today() - timedelta(days=100)).isoformat()
        r2 = s.post(f"{API}/groups/{g['id']}/subscriptions",
                    json={"name": "TEST_F3_OldSub", "category": "productivity",
                          "price": 90000, "billing_cycle": "monthly",
                          "next_due_date": past, "split_type": "equal"},
                    headers=auth(owner["token"]))
        sub = r2.json()["subscription"]

        # Backdate created_at directly in Mongo so history walks past 100 days
        async def _backdate():
            _c, _db = _fresh_db()
            try:
                old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
                await _db.group_subscriptions.update_one(
                    {"id": sub["id"]}, {"$set": {"created_at": old}})
            finally:
                _c.close()
        asyncio.run(_backdate())

        # Trigger auto-advance on detail
        s.get(f"{API}/groups/{g['id']}", headers=auth(owner["token"]))

        r3 = s.get(f"{API}/groups/{g['id']}/history", headers=auth(owner["token"]))
        assert r3.status_code == 200
        hist = r3.json()["history"]
        assert len(hist) == 1
        h = hist[0]
        assert h["subscription"]["name"] == "TEST_F3_OldSub"
        assert len(h["periods"]) >= 2  # at least a couple monthly periods
        # newest-first (period dates strictly descending)
        periods = [p["period"] for p in h["periods"]]
        assert periods == sorted(periods, reverse=True)
        # each period has splits + counts
        for p in h["periods"]:
            assert "splits" in p and isinstance(p["splits"], list)
            assert "paid_count" in p and "member_count" in p
            assert p["member_count"] == len(p["splits"])


# --------------------- reminder_sweep direct ---------------------
def _run_with_fresh_db(coro_factory):
    """Run coro_factory(db) inside a fresh event loop with a fresh Motor client
    swapped into server.db for the duration (reminder_sweep uses server.db).
    """
    async def _wrap():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = client[os.environ["DB_NAME"]]
        original = srv.db
        srv.db = _db
        try:
            return await coro_factory(_db)
        finally:
            srv.db = original
            client.close()
    return asyncio.run(_wrap())


class TestReminderSweep:
    def test_personal_reminder_wa_and_idempotent(self):
        async def _run(_db):
            uid = f"user_swep_{uuid.uuid4().hex[:8]}"
            phone = "6281200099988"
            await _db.wa_outbox.delete_many({"phone": phone})
            await _db.users.insert_one({
                "user_id": uid, "email": f"{uid}@ex.com",
                "name": "TEST_F3_Sweeper", "password_hash": "x",
                "plan": "premium",
                "notify_channels": {"push": True, "whatsapp": True},
                "phone": phone,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            sub_id = str(uuid.uuid4())
            await _db.subscriptions.insert_one({
                "id": sub_id, "user_id": uid,
                "name": "TEST_F3_SweepNetflix", "category": "entertainment",
                "price": 65000, "billing_cycle": "monthly",
                "next_due_date": tomorrow, "status": "paid",
                "reminders": [3, 1, 0], "notes": None, "color": None,
                "deleted_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            await reminder_sweep()
            first = await _db.wa_outbox.count_documents({"phone": phone})
            await reminder_sweep()
            second = await _db.wa_outbox.count_documents({"phone": phone})
            rec = await _db.wa_outbox.find_one({"phone": phone}, {"_id": 0})
            await _db.subscriptions.delete_one({"id": sub_id})
            await _db.users.delete_one({"user_id": uid})
            return first, second, rec

        first, second, rec = _run_with_fresh_db(_run)
        assert first == 1, f"expected 1 WA after sweep, got {first}"
        assert second == 1, f"expected still 1 (dedupe), got {second}"
        assert rec is not None
        msg = rec["message"]
        assert "TEST_F3_Sweeper" in msg
        assert "TEST_F3_SweepNetflix" in msg
        assert "Rp65.000" in msg
        assert "besok" in msg
        assert rec["status"] == "simulated"
        assert rec["simulated"] is True

    def test_group_reminder_only_eligible(self):
        async def _run(_db):
            owner_id = f"user_go_{uuid.uuid4().hex[:8]}"
            elig_id = f"user_ge_{uuid.uuid4().hex[:8]}"
            inel_id = f"user_gi_{uuid.uuid4().hex[:8]}"
            elig_phone = "6281255544433"
            await _db.wa_outbox.delete_many({"phone": elig_phone})

            base = {"password_hash": "x",
                    "notify_channels": {"push": True, "whatsapp": True},
                    "created_at": datetime.now(timezone.utc).isoformat()}
            await _db.users.insert_many([
                {**base, "user_id": owner_id, "email": f"{owner_id}@e", "name": "Own",
                 "plan": "premium", "phone": "6281200000001"},
                {**base, "user_id": elig_id, "email": f"{elig_id}@e", "name": "Elig",
                 "plan": "premium", "phone": elig_phone},
                {"user_id": inel_id, "email": f"{inel_id}@e", "name": "Inelig",
                 "password_hash": "x", "plan": "free",
                 "notify_channels": {"push": True, "whatsapp": False},
                 "phone": None,
                 "created_at": datetime.now(timezone.utc).isoformat()},
            ])
            gid = str(uuid.uuid4())
            await _db.groups.insert_one({
                "id": gid, "name": "TEST_F3_GroupSweep",
                "owner_id": owner_id, "invite_code": uuid.uuid4().hex[:6].upper(),
                "members": [
                    {"user_id": owner_id, "name": "Own",
                     "joined_at": datetime.now(timezone.utc).isoformat()},
                    {"user_id": elig_id, "name": "Elig",
                     "joined_at": datetime.now(timezone.utc).isoformat()},
                    {"user_id": inel_id, "name": "Inelig",
                     "joined_at": datetime.now(timezone.utc).isoformat()},
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            sid = str(uuid.uuid4())
            await _db.group_subscriptions.insert_one({
                "id": sid, "group_id": gid,
                "name": "TEST_F3_GSweepSpotify", "category": "music",
                "price": 60000, "billing_cycle": "monthly",
                "next_due_date": tomorrow, "split_type": "equal",
                "custom_splits": None, "payments": {},
                "deleted_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            await reminder_sweep()
            elig_ct = await _db.wa_outbox.count_documents({"phone": elig_phone})
            # Neither the inel_id (free/no phone) nor anyone with phone=None got a WA.
            inelig_ct = await _db.wa_outbox.count_documents({"phone": None})
            await _db.group_subscriptions.delete_one({"id": sid})
            await _db.groups.delete_one({"id": gid})
            await _db.users.delete_many(
                {"user_id": {"$in": [owner_id, elig_id, inel_id]}})
            return elig_ct, inelig_ct

        elig_ct, inelig_ct = _run_with_fresh_db(_run)
        assert elig_ct >= 1, f"eligible member should get WA, got {elig_ct}"
        assert inelig_ct == 0
