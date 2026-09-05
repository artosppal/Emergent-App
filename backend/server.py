from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import calendar
import asyncio
import re
import bcrypt
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, timedelta, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'notifin-dev-secret')
JWT_ALG = 'HS256'
SESSION_DAYS = 7

# Emergent managed push
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

FREE_PLAN_LIMIT = 3

# WhatsApp via Fonnte (simulation mode while token is empty)
FONNTE_TOKEN = os.environ.get("FONNTE_TOKEN", "")
FONNTE_BASE_URL = "https://api.fonnte.com"


def wa_live() -> bool:
    return bool(FONNTE_TOKEN.strip())

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def make_session_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": now_utc() + timedelta(days=SESSION_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def persist_session(user_id: str, token: str):
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
    })


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "plan": u.get("plan", "free"),
        "phone": u.get("phone"),
        "wa_live": wa_live(),
        "notify_channels": u.get("notify_channels", {"push": True, "whatsapp": False}),
        "monthly_limit": u.get("monthly_limit"),
    }


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    if not re.fullmatch(r"62[1-9][0-9]{7,12}", digits):
        raise ValueError("invalid phone")
    return digits


def fmt_rp(v: float) -> str:
    return "Rp" + f"{round(v or 0):,}".replace(",", ".")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionBody(BaseModel):
    session_id: str


class SubscriptionBody(BaseModel):
    name: str
    category: str = "other"
    price: float = 0
    billing_cycle: str = "monthly"          # monthly | yearly | weekly
    next_due_date: str                      # YYYY-MM-DD
    status: str = "paid"                    # trial | paid
    color: Optional[str] = None
    reminders: List[int] = Field(default_factory=lambda: [3, 1, 0])
    notes: Optional[str] = None
    registered_with: Optional[str] = None   # email/akun/no. HP dipakai daftar (opsional)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    if isinstance(exp, str):
        exp_dt = datetime.fromisoformat(exp)
    else:
        exp_dt = exp
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
    if exp_dt < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    user = {
        "user_id": new_user_id(),
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "picture": None,
        "plan": "free",
        "notify_channels": {"push": True, "whatsapp": False},
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = make_session_token(user["user_id"])
    await persist_session(user["user_id"], token)
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = make_session_token(user["user_id"])
    await persist_session(user["user_id"], token)
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/session")
async def google_session(body: SessionBody):
    try:
        resp = await httpx.AsyncClient(timeout=10.0).get(
            EMERGENT_AUTH_URL, headers={"X-Session-ID": body.session_id}
        )
    except Exception as e:
        logger.warning(f"Emergent auth error: {e}")
        raise HTTPException(status_code=401, detail="Auth gagal")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    data = resp.json()
    email = (data.get("email") or "").lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = existing
    else:
        user = {
            "user_id": new_user_id(),
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "password_hash": None,
            "plan": "free",
            "notify_channels": {"push": True, "whatsapp": False},
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    token = data.get("session_token") or make_session_token(user["user_id"])
    await persist_session(user["user_id"], token)
    return {"session_token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"status": "ok"}


@api_router.post("/auth/upgrade")
async def mock_upgrade(user: dict = Depends(get_current_user)):
    # Fase 1: UI-only upgrade toggle (real payment arrives in Fase 4).
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"plan": "premium"}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(updated)}


@api_router.post("/auth/downgrade")
async def mock_downgrade(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"plan": "free"}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(updated)}


class ChannelsBody(BaseModel):
    push: bool = True
    whatsapp: bool = False


@api_router.put("/auth/channels")
async def update_channels(body: ChannelsBody, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"notify_channels": body.model_dump()}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(updated)}


class PhoneBody(BaseModel):
    phone: str


@api_router.put("/auth/phone")
async def update_phone(body: PhoneBody, user: dict = Depends(get_current_user)):
    raw = body.phone.strip()
    if raw == "":
        normalized = None
    else:
        try:
            normalized = normalize_phone(raw)
        except ValueError:
            raise HTTPException(status_code=422,
                                detail="Nomor WhatsApp tidak valid. Pakai format 08xx atau +62xx")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"phone": normalized}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(updated)}


class LimitBody(BaseModel):
    monthly_limit: Optional[float] = None   # null/0 = tanpa limit


@api_router.put("/auth/limit")
async def update_limit(body: LimitBody, user: dict = Depends(get_current_user)):
    value = body.monthly_limit
    if value is not None and value <= 0:
        raise HTTPException(status_code=422, detail="Limit harus lebih dari 0")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"monthly_limit": value}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": public_user(updated)}


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------
def sub_public(s: dict) -> dict:
    return {
        "id": s["id"],
        "name": s["name"],
        "category": s.get("category", "other"),
        "price": s.get("price", 0),
        "billing_cycle": s.get("billing_cycle", "monthly"),
        "next_due_date": s.get("next_due_date"),
        "status": s.get("status", "paid"),
        "color": s.get("color"),
        "reminders": s.get("reminders", [3, 1, 0]),
        "notes": s.get("notes"),
        "registered_with": s.get("registered_with"),
        "created_at": s.get("created_at"),
    }


def monthly_cost(s: dict) -> float:
    price = float(s.get("price", 0) or 0)
    cycle = s.get("billing_cycle", "monthly")
    if cycle == "yearly":
        return price / 12.0
    if cycle == "weekly":
        return price * 52.0 / 12.0
    return price


async def active_count(user_id: str) -> int:
    return await db.subscriptions.count_documents(
        {"user_id": user_id, "deleted_at": None}
    )


@api_router.get("/subscriptions")
async def list_subscriptions(
    category: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {"user_id": user["user_id"], "deleted_at": None}
    if category and category != "all":
        q["category"] = category
    if status and status != "all":
        q["status"] = status
    docs = await db.subscriptions.find(q, {"_id": 0}).sort("next_due_date", 1).to_list(500)
    return {"subscriptions": [sub_public(d) for d in docs]}


@api_router.post("/subscriptions")
async def create_subscription(body: SubscriptionBody, user: dict = Depends(get_current_user)):
    if user.get("plan", "free") == "free":
        count = await active_count(user["user_id"])
        if count >= FREE_PLAN_LIMIT:
            raise HTTPException(
                status_code=403,
                detail={"code": "limit_reached",
                        "message": f"Paket gratis maksimal {FREE_PLAN_LIMIT} langganan aktif."},
            )
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        **body.model_dump(),
        "deleted_at": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.subscriptions.insert_one(doc)
    return {"subscription": sub_public(doc)}


@api_router.get("/subscriptions/{sub_id}")
async def get_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    doc = await db.subscriptions.find_one(
        {"id": sub_id, "user_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    return {"subscription": sub_public(doc)}


@api_router.put("/subscriptions/{sub_id}")
async def update_subscription(sub_id: str, body: SubscriptionBody, user: dict = Depends(get_current_user)):
    doc = await db.subscriptions.find_one(
        {"id": sub_id, "user_id": user["user_id"], "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    update = {**body.model_dump(), "updated_at": now_utc().isoformat()}
    await db.subscriptions.update_one({"id": sub_id}, {"$set": update})
    updated = await db.subscriptions.find_one({"id": sub_id}, {"_id": 0})
    return {"subscription": sub_public(updated)}


@api_router.delete("/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    doc = await db.subscriptions.find_one(
        {"id": sub_id, "user_id": user["user_id"], "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    await db.subscriptions.update_one(
        {"id": sub_id}, {"$set": {"deleted_at": now_utc().isoformat()}})
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    docs = await db.subscriptions.find(
        {"user_id": user["user_id"], "deleted_at": None}, {"_id": 0}).to_list(500)

    total_monthly = 0.0
    by_cat: dict = {}
    upcoming = []
    ending_trials = []
    most_exp = None
    most_exp_cost = 0.0
    today = date.today()
    horizon = today + timedelta(days=7)

    for d in docs:
        m = monthly_cost(d)
        total_monthly += m
        if m > most_exp_cost:
            most_exp_cost = m
            most_exp = d
        cat = d.get("category", "other")
        by_cat.setdefault(cat, {"category": cat, "total": 0.0, "count": 0})
        by_cat[cat]["total"] += m
        by_cat[cat]["count"] += 1

        due_raw = d.get("next_due_date")
        try:
            due = date.fromisoformat(due_raw)
        except Exception:
            due = None
        if due is not None:
            days_left = (due - today).days
            if today <= due <= horizon:
                pub = sub_public(d)
                pub["days_left"] = days_left
                upcoming.append(pub)
            if d.get("status") == "trial" and 0 <= days_left <= 14:
                pub = sub_public(d)
                pub["days_left"] = days_left
                ending_trials.append(pub)

    upcoming.sort(key=lambda x: x.get("days_left", 99))
    ending_trials.sort(key=lambda x: x.get("days_left", 99))
    by_category = sorted(by_cat.values(), key=lambda x: x["total"], reverse=True)

    return {
        "total_this_month": round(total_monthly),
        "projection_next_month": round(total_monthly),
        "active_count": len(docs),
        "plan": user.get("plan", "free"),
        "free_limit": FREE_PLAN_LIMIT,
        "upcoming": upcoming,
        "most_expensive": (
            {**sub_public(most_exp), "monthly_cost": round(most_exp_cost)}
            if most_exp is not None and most_exp_cost > 0 else None
        ),
        "ending_trials": ending_trials,
        "by_category": [
            {"category": c["category"], "total": round(c["total"]), "count": c["count"]}
            for c in by_category
        ],
    }


# ---------------------------------------------------------------------------
# Fase 2: Groups (Family/Team Sharing)
# ---------------------------------------------------------------------------
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def gen_invite_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def add_cycle(d: date, cycle: str) -> date:
    if cycle == "weekly":
        return d + timedelta(days=7)
    if cycle == "yearly":
        try:
            return d.replace(year=d.year + 1)
        except ValueError:
            return d.replace(year=d.year + 1, day=28)
    y, m = d.year, d.month + 1
    if m > 12:
        y, m = y + 1, 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


async def advance_group_sub(s: dict) -> dict:
    """Auto-advance due date past today; payments are keyed per due date so
    statuses reset automatically each new billing period."""
    try:
        due = date.fromisoformat(s.get("next_due_date"))
    except Exception:
        return s
    today = date.today()
    changed = False
    while due < today:
        due = add_cycle(due, s.get("billing_cycle", "monthly"))
        changed = True
    if changed:
        s["next_due_date"] = due.isoformat()
        await db.group_subscriptions.update_one(
            {"id": s["id"]}, {"$set": {"next_due_date": s["next_due_date"]}})
    return s


def compute_splits(s: dict, members: List[dict], period: Optional[str] = None) -> List[dict]:
    period = period or s.get("next_due_date") or ""
    payments = (s.get("payments") or {}).get(period, {})
    splits = []
    if s.get("split_type") == "custom":
        cs = s.get("custom_splits") or {}
        for m in members:
            splits.append({
                "user_id": m["user_id"],
                "name": m.get("name") or "Anggota",
                "amount": round(float(cs.get(m["user_id"], 0) or 0)),
                "paid": bool(payments.get(m["user_id"])),
            })
    else:
        n = max(len(members), 1)
        share = float(s.get("price", 0) or 0) / n
        for m in members:
            splits.append({
                "user_id": m["user_id"],
                "name": m.get("name") or "Anggota",
                "amount": round(share),
                "paid": bool(payments.get(m["user_id"])),
            })
    return splits


def group_sub_public(s: dict) -> dict:
    return {
        "id": s["id"],
        "name": s["name"],
        "category": s.get("category", "other"),
        "price": s.get("price", 0),
        "billing_cycle": s.get("billing_cycle", "monthly"),
        "next_due_date": s.get("next_due_date"),
        "split_type": s.get("split_type", "equal"),
        "custom_splits": s.get("custom_splits"),
        "created_at": s.get("created_at"),
    }


class GroupBody(BaseModel):
    name: str


class JoinBody(BaseModel):
    code: str


class GroupSubBody(BaseModel):
    name: str
    category: str = "other"
    price: float = 0
    billing_cycle: str = "monthly"
    next_due_date: str
    split_type: str = "equal"               # equal | custom
    custom_splits: Optional[dict] = None    # {user_id: amount}


class PayBody(BaseModel):
    user_id: Optional[str] = None
    paid: bool = True


async def get_group_for_member(gid: str, user_id: str) -> dict:
    g = await db.groups.find_one({"id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    if not any(m["user_id"] == user_id for m in g.get("members", [])):
        raise HTTPException(status_code=403, detail="Kamu bukan anggota grup ini")
    return g


@api_router.post("/groups")
async def create_group(body: GroupBody, user: dict = Depends(get_current_user)):
    if user.get("plan", "free") != "premium":
        raise HTTPException(
            status_code=403,
            detail={"code": "premium_required",
                    "message": "Buat grup adalah fitur Premium. Semua orang tetap bisa gabung lewat kode."},
        )
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Nama grup wajib diisi")
    code = gen_invite_code()
    for _ in range(5):
        if not await db.groups.find_one({"invite_code": code}):
            break
        code = gen_invite_code()
    g = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "owner_id": user["user_id"],
        "invite_code": code,
        "members": [{"user_id": user["user_id"], "name": user.get("name"),
                     "joined_at": now_utc().isoformat()}],
        "created_at": now_utc().isoformat(),
    }
    await db.groups.insert_one(g)
    g.pop("_id", None)
    return {"group": g}


@api_router.get("/groups")
async def list_groups(user: dict = Depends(get_current_user)):
    docs = await db.groups.find(
        {"members.user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for g in docs:
        subs = await db.group_subscriptions.find(
            {"group_id": g["id"], "deleted_at": None}, {"_id": 0}).to_list(200)
        my_share = 0.0
        total_price = 0.0
        for s in subs:
            total_price += float(s.get("price", 0) or 0)
            for sp in compute_splits(s, g.get("members", [])):
                if sp["user_id"] == user["user_id"]:
                    my_share += sp["amount"]
        out.append({
            "id": g["id"],
            "name": g["name"],
            "invite_code": g["invite_code"],
            "is_owner": g["owner_id"] == user["user_id"],
            "member_count": len(g.get("members", [])),
            "sub_count": len(subs),
            "my_share": round(my_share),
            "total_price": round(total_price),
        })
    return {"groups": out}


@api_router.post("/groups/join")
async def join_group(body: JoinBody, user: dict = Depends(get_current_user)):
    code = body.code.strip().upper()
    g = await db.groups.find_one({"invite_code": code}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Kode grup tidak ditemukan")
    if any(m["user_id"] == user["user_id"] for m in g.get("members", [])):
        raise HTTPException(status_code=409, detail="Kamu sudah jadi anggota grup ini")
    await db.groups.update_one(
        {"id": g["id"]},
        {"$push": {"members": {"user_id": user["user_id"], "name": user.get("name"),
                               "joined_at": now_utc().isoformat()}}})
    return {"status": "joined", "group_id": g["id"], "name": g["name"]}


@api_router.get("/groups/{gid}")
async def group_detail(gid: str, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    members = g.get("members", [])
    subs_docs = await db.group_subscriptions.find(
        {"group_id": gid, "deleted_at": None}, {"_id": 0}).sort("next_due_date", 1).to_list(200)

    subs = []
    unpaid_names: set = set()
    total_price = 0.0
    my_total = 0.0
    for s in subs_docs:
        s = await advance_group_sub(s)
        splits = compute_splits(s, members)
        unpaid = [sp for sp in splits if not sp["paid"] and sp["amount"] > 0]
        for sp in unpaid:
            unpaid_names.add(sp["name"])
        mine = next((sp for sp in splits if sp["user_id"] == user["user_id"]), None)
        total_price += float(s.get("price", 0) or 0)
        if mine:
            my_total += mine["amount"]
        subs.append({
            **group_sub_public(s),
            "splits": splits,
            "unpaid_count": len(unpaid),
            "my_amount": mine["amount"] if mine else 0,
            "my_paid": mine["paid"] if mine else False,
        })

    return {"group": {
        "id": g["id"],
        "name": g["name"],
        "owner_id": g["owner_id"],
        "invite_code": g["invite_code"],
        "is_owner": g["owner_id"] == user["user_id"],
        "members": [{**m, "is_owner": m["user_id"] == g["owner_id"]} for m in members],
        "subscriptions": subs,
        "unpaid_members": sorted(unpaid_names),
        "total_price": round(total_price),
        "my_total": round(my_total),
        "created_at": g.get("created_at"),
    }}


@api_router.post("/groups/{gid}/leave")
async def leave_group(gid: str, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] == user["user_id"]:
        raise HTTPException(status_code=400,
                            detail="Koordinator tidak bisa keluar. Hapus grup jika sudah tidak dipakai.")
    await db.groups.update_one(
        {"id": gid}, {"$pull": {"members": {"user_id": user["user_id"]}}})
    return {"status": "left"}


@api_router.delete("/groups/{gid}")
async def delete_group(gid: str, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya koordinator yang bisa menghapus grup")
    await db.group_subscriptions.delete_many({"group_id": gid})
    await db.groups.delete_one({"id": gid})
    return {"status": "deleted"}


@api_router.post("/groups/{gid}/subscriptions")
async def create_group_sub(gid: str, body: GroupSubBody, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya koordinator yang bisa menambah langganan grup")
    doc = {
        "id": str(uuid.uuid4()),
        "group_id": gid,
        **body.model_dump(),
        "payments": {},
        "deleted_at": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.group_subscriptions.insert_one(doc)
    return {"subscription": group_sub_public(doc)}


@api_router.put("/groups/{gid}/subscriptions/{sid}")
async def update_group_sub(gid: str, sid: str, body: GroupSubBody,
                           user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya koordinator yang bisa mengubah langganan grup")
    doc = await db.group_subscriptions.find_one(
        {"id": sid, "group_id": gid, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Langganan grup tidak ditemukan")
    await db.group_subscriptions.update_one(
        {"id": sid}, {"$set": {**body.model_dump(), "updated_at": now_utc().isoformat()}})
    updated = await db.group_subscriptions.find_one({"id": sid}, {"_id": 0})
    return {"subscription": group_sub_public(updated)}


@api_router.delete("/groups/{gid}/subscriptions/{sid}")
async def delete_group_sub(gid: str, sid: str, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya koordinator yang bisa menghapus langganan grup")
    res = await db.group_subscriptions.update_one(
        {"id": sid, "group_id": gid, "deleted_at": None},
        {"$set": {"deleted_at": now_utc().isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Langganan grup tidak ditemukan")
    return {"status": "deleted"}


@api_router.put("/groups/{gid}/subscriptions/{sid}/pay")
async def pay_group_sub(gid: str, sid: str, body: PayBody,
                        user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    target = body.user_id or user["user_id"]
    if target != user["user_id"] and g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403,
                            detail="Hanya koordinator yang bisa mengubah status bayar anggota lain")
    if not any(m["user_id"] == target for m in g.get("members", [])):
        raise HTTPException(status_code=404, detail="Anggota tidak ditemukan")
    s = await db.group_subscriptions.find_one(
        {"id": sid, "group_id": gid, "deleted_at": None}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Langganan grup tidak ditemukan")
    s = await advance_group_sub(s)
    period = s["next_due_date"]
    await db.group_subscriptions.update_one(
        {"id": sid}, {"$set": {f"payments.{period}.{target}": body.paid}})
    return {"status": "ok", "period": period, "user_id": target, "paid": body.paid}


# ---------------------------------------------------------------------------
# Fase 3: WhatsApp (Fonnte) + reminder scheduler + nudge + payment history
# ---------------------------------------------------------------------------
async def send_whatsapp(phone: str, message: str) -> dict:
    record = {"phone": phone, "message": message, "created_at": now_utc().isoformat()}
    if not wa_live():
        record.update({"simulated": True, "status": "simulated"})
        await db.wa_outbox.insert_one(record)
        logger.info(f"[WA SIMULASI] -> {phone}: {message}")
        return {"status": True, "simulated": True}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as c:
            resp = await c.post(
                f"{FONNTE_BASE_URL}/send",
                headers={"Authorization": FONNTE_TOKEN.strip()},
                data={"target": phone, "message": message, "countryCode": "0"},
            )
        result = resp.json()
        ok = result.get("status") is True
        record.update({"simulated": False,
                       "status": "sent" if ok else "failed", "fonnte": result})
        await db.wa_outbox.insert_one(record)
        if not ok:
            logger.warning(f"Fonnte rejected: {result.get('reason')}")
        return {"status": ok, "simulated": False}
    except Exception as e:
        record.update({"simulated": False, "status": "error", "error": str(e)})
        await db.wa_outbox.insert_one(record)
        logger.warning(f"Fonnte send failed: {e}")
        return {"status": False, "simulated": False}


def when_label(offset: int) -> str:
    if offset == 0:
        return "hari ini"
    if offset == 1:
        return "besok"
    return f"{offset} hari lagi (H-{offset})"


async def claim_notif(key: str) -> bool:
    """Idempotency claim — returns False if this notification was already sent."""
    try:
        await db.notif_log.insert_one({"key": key, "created_at": now_utc().isoformat()})
        return True
    except Exception:
        return False


async def reminder_sweep():
    today = date.today()

    # Personal subscriptions -> WhatsApp for premium users with WA enabled + phone.
    users = await db.users.find(
        {"plan": "premium", "notify_channels.whatsapp": True,
         "phone": {"$nin": [None, ""]}}, {"_id": 0}).to_list(1000)
    for u in users:
        subs = await db.subscriptions.find(
            {"user_id": u["user_id"], "deleted_at": None}, {"_id": 0}).to_list(500)
        for s in subs:
            try:
                due = date.fromisoformat(s.get("next_due_date"))
            except Exception:
                continue
            offset = (due - today).days
            if offset not in (s.get("reminders") or []):
                continue
            key = f"wa:personal:{s['id']}:{s['next_due_date']}:{offset}"
            if await claim_notif(key):
                msg = (f"Halo {u.get('name') or 'kamu'}! 🔔 Langganan {s['name']} kamu "
                       f"{fmt_rp(s.get('price', 0))} jatuh tempo {when_label(offset)}. "
                       f"Jangan lupa bayar atau cancel ya — Notifin")
                await send_whatsapp(u["phone"], msg)

    # Group subscriptions -> push to unpaid members, WA to eligible unpaid members.
    gsubs = await db.group_subscriptions.find(
        {"deleted_at": None}, {"_id": 0}).to_list(2000)
    for s in gsubs:
        s = await advance_group_sub(s)
        try:
            due = date.fromisoformat(s.get("next_due_date"))
        except Exception:
            continue
        offset = (due - today).days
        if offset not in (3, 1, 0):
            continue
        g = await db.groups.find_one({"id": s["group_id"]}, {"_id": 0})
        if not g:
            continue
        for sp in compute_splits(s, g.get("members", [])):
            if sp["paid"] or sp["amount"] <= 0:
                continue
            uid = sp["user_id"]
            body_text = (f"Bagianmu {fmt_rp(sp['amount'])} untuk {s['name']} di grup "
                         f"\"{g['name']}\" jatuh tempo {when_label(offset)}.")
            if await claim_notif(f"push:group:{s['id']}:{s['next_due_date']}:{offset}:{uid}"):
                try:
                    await send_push([uid], {"title": "Tagihan grup 🔔", "message": body_text})
                except Exception as e:
                    logger.info(f"group push skipped: {e}")
            member = await db.users.find_one({"user_id": uid}, {"_id": 0})
            if (member and member.get("plan") == "premium"
                    and member.get("notify_channels", {}).get("whatsapp")
                    and member.get("phone")):
                if await claim_notif(f"wa:group:{s['id']}:{s['next_due_date']}:{offset}:{uid}"):
                    msg = (f"Halo {member.get('name')}! 🔔 {body_text} "
                           f"Jangan lupa bayar ya — Notifin")
                    await send_whatsapp(member["phone"], msg)


async def scheduler_loop():
    await asyncio.sleep(10)
    while True:
        try:
            await reminder_sweep()
        except Exception as e:
            logger.warning(f"reminder sweep failed: {e}")
        await asyncio.sleep(1800)


class NudgeBody(BaseModel):
    user_id: str


@api_router.post("/groups/{gid}/subscriptions/{sid}/nudge")
async def nudge_member(gid: str, sid: str, body: NudgeBody,
                       user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya koordinator yang bisa mengingatkan anggota")
    if body.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa mengingatkan diri sendiri")
    if not any(m["user_id"] == body.user_id for m in g.get("members", [])):
        raise HTTPException(status_code=404, detail="Anggota tidak ditemukan")
    s = await db.group_subscriptions.find_one(
        {"id": sid, "group_id": gid, "deleted_at": None}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Langganan grup tidak ditemukan")
    s = await advance_group_sub(s)
    sp = next((x for x in compute_splits(s, g.get("members", []))
               if x["user_id"] == body.user_id), None)
    if not sp:
        raise HTTPException(status_code=404, detail="Anggota tidak ditemukan")
    if sp["paid"]:
        raise HTTPException(status_code=400, detail="Anggota ini sudah bayar")

    key = f"nudge:{sid}:{s['next_due_date']}:{body.user_id}:{date.today().isoformat()}"
    if not await claim_notif(key):
        raise HTTPException(status_code=429,
                            detail="Sudah diingatkan hari ini. Coba lagi besok ya.")

    channels = []
    body_text = (f"Bagianmu {fmt_rp(sp['amount'])} untuk {s['name']} di grup "
                 f"\"{g['name']}\" belum dibayar. Yuk segera lunasi!")
    try:
        await send_push([body.user_id],
                        {"title": f"{user.get('name')} mengingatkan 👋", "message": body_text})
        channels.append("push")
    except Exception as e:
        logger.info(f"nudge push skipped: {e}")
    target = await db.users.find_one({"user_id": body.user_id}, {"_id": 0})
    if target and target.get("phone"):
        res = await send_whatsapp(
            target["phone"],
            f"Halo {target.get('name')}! 👋 {user.get('name')} mengingatkan: {body_text} — Notifin")
        if res.get("status"):
            channels.append("whatsapp")
    return {"status": "sent", "channels": channels, "wa_simulated": not wa_live()}


# ---------------------------------------------------------------------------
# TESTING ONLY — manually fire a WhatsApp reminder for one subscription.
# Does not touch reminder_sweep()/scheduler_loop() or their day-offset
# (H-3/H-1/H-0) and notif_log dedup rules at all — this bypasses all of
# that on purpose so you can test sending without waiting for the
# scheduler or hitting the "already sent today" guard. Safe to leave in:
# while FONNTE_TOKEN is unset, send_whatsapp() stays in simulation mode
# (logs + wa_outbox only, no real message goes out).
# ---------------------------------------------------------------------------
class TestReminderBody(BaseModel):
    subscription_id: str


@api_router.post("/test/send-reminder")
async def test_send_reminder(body: TestReminderBody, user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one(
        {"id": body.subscription_id, "user_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if not user.get("phone"):
        raise HTTPException(status_code=422, detail="Nomor WhatsApp belum diatur di akun ini")

    msg = (f"[TEST] Halo {user.get('name') or 'kamu'}! 🔔 Langganan {sub['name']} kamu "
           f"{fmt_rp(sub.get('price', 0))} jatuh tempo tanggal {sub.get('next_due_date')}. "
           f"Jangan lupa bayar atau cancel ya — Notifin")
    result = await send_whatsapp(user["phone"], msg)
    return {
        "status": "sent" if result.get("status") else "failed",
        "simulated": result.get("simulated", not wa_live()),
        "phone": user["phone"],
        "message": msg,
    }


def cycle_back(d: date, cycle: str) -> date:
    if cycle == "weekly":
        return d - timedelta(days=7)
    if cycle == "yearly":
        try:
            return d.replace(year=d.year - 1)
        except ValueError:
            return d.replace(year=d.year - 1, day=28)
    y, m = d.year, d.month - 1
    if m < 1:
        y, m = y - 1, 12
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


@api_router.get("/groups/{gid}/history")
async def group_history(gid: str, user: dict = Depends(get_current_user)):
    g = await get_group_for_member(gid, user["user_id"])
    members = g.get("members", [])
    subs_docs = await db.group_subscriptions.find(
        {"group_id": gid, "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(200)

    out = []
    for s in subs_docs:
        s = await advance_group_sub(s)
        try:
            cur = date.fromisoformat(s["next_due_date"])
        except Exception:
            continue
        try:
            created = datetime.fromisoformat(s["created_at"]).date()
        except Exception:
            created = None
        cycle = s.get("billing_cycle", "monthly")
        periods = []
        p = cycle_back(cur, cycle)
        count = 0
        while count < 12 and (created is None or p >= created):
            key = p.isoformat()
            splits = compute_splits(s, members, period=key)
            periods.append({
                "period": key,
                "splits": splits,
                "paid_count": sum(1 for x in splits if x["paid"]),
                "member_count": len(splits),
            })
            p = cycle_back(p, cycle)
            count += 1
        if periods:
            out.append({"subscription": group_sub_public(s), "periods": periods})
    return {"history": out}


# ---------------------------------------------------------------------------
# Push notifications (Emergent managed relay)
# ---------------------------------------------------------------------------
@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            # Preview env has a placeholder push key; real key is injected at deploy.
            logger.info("register-push skipped: push key not active yet")
            return {"status": "skipped"}
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"register-push failed (non-blocking): {e}")
        return {"status": "skipped"}
    return {"status": "registered"}


async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None) -> None:
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


@api_router.get("/")
async def root():
    return {"message": "Notifin API", "status": "ok"}


# ---------------------------------------------------------------------------
# Startup: indexes
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.subscriptions.create_index("user_id")
        await db.subscriptions.create_index("id", unique=True)
        await db.groups.create_index("id", unique=True)
        await db.groups.create_index("invite_code", unique=True)
        await db.groups.create_index("members.user_id")
        await db.group_subscriptions.create_index("id", unique=True)
        await db.group_subscriptions.create_index("group_id")
        await db.notif_log.create_index("key", unique=True)
    except Exception as e:
        logger.warning(f"index creation: {e}")
    asyncio.create_task(scheduler_loop())


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://emergent-app-vert.vercel.app",
        "https://notifin.online",
        "https://www.notifin.online",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await _push_client.aclose()
