from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
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
        "notify_channels": u.get("notify_channels", {"push": True, "whatsapp": False}),
    }


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
    today = date.today()
    horizon = today + timedelta(days=7)

    for d in docs:
        m = monthly_cost(d)
        total_monthly += m
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

    upcoming.sort(key=lambda x: x.get("days_left", 99))
    by_category = sorted(by_cat.values(), key=lambda x: x["total"], reverse=True)

    return {
        "total_this_month": round(total_monthly),
        "projection_next_month": round(total_monthly),
        "active_count": len(docs),
        "plan": user.get("plan", "free"),
        "free_limit": FREE_PLAN_LIMIT,
        "upcoming": upcoming,
        "by_category": [
            {"category": c["category"], "total": round(c["total"]), "count": c["count"]}
            for c in by_category
        ],
    }


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
    except Exception as e:
        logger.warning(f"index creation: {e}")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await _push_client.aclose()
