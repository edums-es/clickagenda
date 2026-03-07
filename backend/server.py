from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import secrets
import httpx
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))

app = FastAPI()
api_router = APIRouter(prefix="/api")

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==================== MODELS ====================

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    business_name: Optional[str] = ""
    slug: Optional[str] = ""
    role: Optional[str] = "professional"  # "professional" or "client"

class UserLogin(BaseModel):
    email: str
    password: str

class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    duration_minutes: int = 60
    price: float = 0
    buffer_minutes: int = 15
    category: Optional[str] = ""
    active: bool = True

class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []

class AppointmentCreate(BaseModel):
    service_id: str
    client_name: str
    client_phone: str
    client_email: Optional[str] = ""
    date: str
    start_time: str
    notes: Optional[str] = ""

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    business_name: Optional[str] = None
    slug: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    business_type: Optional[str] = None
    picture: Optional[str] = None
    cover_picture: Optional[str] = None
    social_links: Optional[dict] = None
    featured_service_ids: Optional[List[str]] = None
    min_advance_hours: Optional[int] = None
    cancellation_policy_hours: Optional[int] = None
    city: Optional[str] = None
    state: Optional[str] = None

class QuickLinkCreate(BaseModel):
    service_id: str
    discount_percent: int = 10
    expires_hours: int = 24
    max_uses: int = 5

class TurboOfferCreate(BaseModel):
    service_id: str
    date: str
    start_time: str
    discount_percent: int = 20
    expires_hours: int = 24


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def generate_session_token() -> str:
    return secrets.token_urlsafe(64)

def normalize_phone(value: str) -> str:
    return re.sub(r"\D", "", value or "")

def build_phone_regex(digits: str) -> str:
    if not digits:
        return ""
    pattern = r"\D*".join([re.escape(ch) for ch in digits])
    return pattern

async def log_auth_event(request: Request, user_id: str, action: str, provider: str, email: str = ""):
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "")
    event = {
        "event_id": f"auth_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "email": email,
        "action": action,
        "provider": provider,
        "ip_address": ip_address,
        "user_agent": request.headers.get("user-agent", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        await db.auth_events.insert_one(event)
    except Exception as exc:
        logger.warning("Auth event log failed: %s", exc)

async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_optional_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

def is_https_request(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return forwarded_proto.lower() == "https"
    return request.url.scheme == "https"

async def create_session(user_id: str, request: Request, response: Response) -> str:
    session_token = generate_session_token()
    await db.user_sessions.insert_one({
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    is_secure = is_https_request(request)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_secure,
        samesite="none" if is_secure else "lax",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return session_token


# ==================== SLOT CALCULATION ====================

def time_to_minutes(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])

def minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"

async def calculate_slots(user_id: str, date_str: str, service_id: str):
    service = await db.services.find_one({"service_id": service_id, "user_id": user_id}, {"_id": 0})
    if not service:
        return []

    duration = service["duration_minutes"]
    buffer = service.get("buffer_minutes", 0)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    min_advance = user.get("min_advance_hours", 2) if user else 2

    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    day_of_week = date_obj.weekday()

    rules = await db.availability_rules.find(
        {"user_id": user_id, "day_of_week": day_of_week, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    if not rules:
        return []

    breaks_list = await db.breaks.find(
        {"user_id": user_id, "$or": [{"day_of_week": day_of_week}, {"day_of_week": -1}]},
        {"_id": 0}
    ).to_list(100)

    existing = await db.appointments.find(
        {"user_id": user_id, "date": date_str, "status": {"$nin": ["cancelled", "no_show"]}},
        {"_id": 0}
    ).to_list(1000)

    holiday = await db.holidays.find_one({"user_id": user_id, "date": date_str}, {"_id": 0})
    if holiday:
        return []

    slots = []
    now = datetime.now(timezone.utc)

    for rule in rules:
        start = time_to_minutes(rule["start_time"])
        end = time_to_minutes(rule["end_time"])
        current = start

        while current + duration <= end:
            slot_start = current
            slot_end = current + duration

            overlaps_break = False
            for brk in breaks_list:
                brk_start = time_to_minutes(brk["start_time"])
                brk_end = time_to_minutes(brk["end_time"])
                if slot_start < brk_end and slot_end > brk_start:
                    overlaps_break = True
                    break

            if not overlaps_break:
                overlaps_apt = False
                for apt in existing:
                    apt_start = time_to_minutes(apt["start_time"])
                    apt_end = time_to_minutes(apt["end_time"])
                    if slot_start < (apt_end + buffer) and slot_end > (apt_start - buffer):
                        overlaps_apt = True
                        break

                if not overlaps_apt:
                    slot_dt = date_obj.replace(
                        hour=slot_start // 60,
                        minute=slot_start % 60,
                        tzinfo=timezone.utc
                    )
                    if slot_dt > now + timedelta(hours=max(0, min_advance - 3)):
                        slots.append({
                            "start_time": minutes_to_time(slot_start),
                            "end_time": minutes_to_time(slot_end)
                        })

            current += 30

    return sorted(slots, key=lambda s: s["start_time"])


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserRegister, request: Request, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Email ja cadastrado")

    slug = data.slug or data.name.lower().replace(" ", "-").replace(".", "")
    slug_check = await db.users.find_one({"slug": slug}, {"_id": 0})
    if slug_check:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    role = data.role if data.role in ("professional", "client") else "professional"
    user = {
        "user_id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "slug": slug,
        "role": role,
        "phone": "",
        "bio": "",
        "picture": "",
        "cover_picture": "",
        "business_name": data.business_name or "",
        "business_type": "",
        "address": "",
        "city": "",
        "state": "",
        "social_links": {},
        "featured_service_ids": [],
        "min_advance_hours": 2,
        "cancellation_policy_hours": 6,
        "onboarding_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)

    default_rules = []
    if role == "professional":
        for day in range(5):
            default_rules.append({
                "rule_id": f"rule_{uuid.uuid4().hex[:8]}",
                "user_id": user_id,
                "day_of_week": day,
                "start_time": "09:00",
                "end_time": "18:00",
                "is_active": True
            })
        default_rules.append({
            "rule_id": f"rule_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "day_of_week": 5,
            "start_time": "09:00",
            "end_time": "13:00",
            "is_active": True
        })
    if default_rules:
        await db.availability_rules.insert_many(default_rules)
        await db.breaks.insert_one({
            "break_id": f"brk_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "day_of_week": -1,
            "start_time": "12:00",
            "end_time": "13:00"
        })

    session_token = await create_session(user_id, request, response)
    await log_auth_event(request, user_id, "register", "password", user["email"])
    user_data = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"user": user_data, "session_token": session_token}


@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Email ou senha incorretos")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha incorretos")

    session_token = await create_session(user["user_id"], request, response)
    await log_auth_event(request, user["user_id"], "login", "password", user["email"])
    user_data = {k: v for k, v in user.items() if k != "password_hash"}
    return {"user": user_data, "session_token": session_token}


@api_router.post("/auth/google-session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid Google session")

    google_data = resp.json()
    email = google_data["email"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        slug = google_data["name"].lower().replace(" ", "-").replace(".", "")
        slug_check = await db.users.find_one({"slug": slug}, {"_id": 0})
        if slug_check:
            slug = f"{slug}-{uuid.uuid4().hex[:4]}"

        user = {
            "user_id": user_id,
            "email": email,
            "password_hash": None,
            "name": google_data["name"],
            "slug": slug,
            "role": "client",
            "phone": "",
            "bio": "",
            "picture": google_data.get("picture", ""),
            "cover_picture": "",
            "business_name": "",
            "business_type": "",
            "address": "",
            "city": "",
            "state": "",
            "social_links": {},
            "featured_service_ids": [],
            "min_advance_hours": 2,
            "cancellation_policy_hours": 6,
            "onboarding_completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)

        default_rules = []
        for day in range(5):
            default_rules.append({
                "rule_id": f"rule_{uuid.uuid4().hex[:8]}",
                "user_id": user_id,
                "day_of_week": day,
                "start_time": "09:00",
                "end_time": "18:00",
                "is_active": True
            })
        default_rules.append({
            "rule_id": f"rule_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "day_of_week": 5,
            "start_time": "09:00",
            "end_time": "13:00",
            "is_active": True
        })
        if default_rules:
            await db.availability_rules.insert_many(default_rules)
        auth_action = "google_register"
    else:
        user_id = user["user_id"]
        if google_data.get("picture"):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"picture": google_data["picture"]}}
            )
            user["picture"] = google_data["picture"]
        auth_action = "google_login"

    session_token = await create_session(user_id, request, response)
    await log_auth_event(request, user_id, auth_action, "google", email)
    user_data = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"user": user_data, "session_token": session_token}


@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    is_secure = is_https_request(request)
    response.delete_cookie(
        key="session_token",
        path="/",
        samesite="none" if is_secure else "lax",
        secure=is_secure
    )
    return {"message": "Logout realizado"}


# ==================== PROFILE ROUTES ====================

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "phone" in update_data:
        update_data["phone_norm"] = normalize_phone(update_data["phone"])
    if "slug" in update_data:
        existing = await db.users.find_one(
            {"slug": update_data["slug"], "user_id": {"$ne": user["user_id"]}},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(400, "Este link ja esta em uso")
    if "social_links" in update_data and not isinstance(update_data["social_links"], dict):
        raise HTTPException(400, "Links sociais invalidos")
    if "featured_service_ids" in update_data:
        if not isinstance(update_data["featured_service_ids"], list):
            raise HTTPException(400, "Servicos em destaque invalidos")
        unique_ids = []
        seen = set()
        for service_id in update_data["featured_service_ids"]:
            if service_id and service_id not in seen:
                unique_ids.append(service_id)
                seen.add(service_id)
        unique_ids = unique_ids[:3]
        if unique_ids:
            active_services = await db.services.find(
                {"user_id": user["user_id"], "active": True, "service_id": {"$in": unique_ids}},
                {"_id": 0, "service_id": 1}
            ).to_list(100)
            allowed = {svc["service_id"] for svc in active_services}
            unique_ids = [service_id for service_id in unique_ids if service_id in allowed]
        update_data["featured_service_ids"] = unique_ids

    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})

    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {k: v for k, v in updated.items() if k != "password_hash"}


@api_router.post("/profile/upload")
async def upload_profile_image(
    request: Request,
    image_type: str = "picture",
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    if image_type not in ("picture", "cover_picture"):
        raise HTTPException(400, "Tipo de imagem invalido")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Arquivo invalido")

    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if not ext:
        content_ext = (file.content_type.split("/")[-1] or "").lower()
        ext = f".{content_ext}" if content_ext else ".png"

    saved_name = f"{user['user_id']}_{image_type}_{uuid.uuid4().hex[:10]}{ext}"
    saved_path = UPLOAD_DIR / saved_name
    content = await file.read()
    saved_path.write_bytes(content)

    public_url = f"{request.base_url}uploads/{saved_name}"
    return {"url": public_url}


# ==================== SERVICES ROUTES ====================

@api_router.get("/services")
async def list_services(user=Depends(get_current_user)):
    services = await db.services.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return services

@api_router.post("/services")
async def create_service(data: ServiceCreate, user=Depends(get_current_user)):
    service = {
        "service_id": f"svc_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.services.insert_one(service)
    result = await db.services.find_one({"service_id": service["service_id"]}, {"_id": 0})
    return result

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, data: ServiceCreate, user=Depends(get_current_user)):
    await db.services.update_one(
        {"service_id": service_id, "user_id": user["user_id"]},
        {"$set": data.model_dump()}
    )
    updated = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Servico nao encontrado")
    return updated

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user=Depends(get_current_user)):
    result = await db.services.delete_one({"service_id": service_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Servico nao encontrado")
    return {"message": "Servico removido"}


# ==================== CLIENTS ROUTES ====================

@api_router.get("/clients")
async def list_clients(user=Depends(get_current_user), search: Optional[str] = None):
    query = {"user_id": user["user_id"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    clients = await db.clients.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return clients

@api_router.post("/clients")
async def create_client(data: ClientCreate, user=Depends(get_current_user)):
    client_doc = {
        "client_id": f"cli_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_visit": None
    }
    await db.clients.insert_one(client_doc)
    result = await db.clients.find_one({"client_id": client_doc["client_id"]}, {"_id": 0})
    return result

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, data: ClientCreate, user=Depends(get_current_user)):
    await db.clients.update_one(
        {"client_id": client_id, "user_id": user["user_id"]},
        {"$set": data.model_dump()}
    )
    updated = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Cliente nao encontrado")
    return updated

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user)):
    result = await db.clients.delete_one({"client_id": client_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Cliente nao encontrado")
    return {"message": "Cliente removido"}


# ==================== APPOINTMENTS ROUTES ====================

@api_router.get("/appointments")
async def list_appointments(
    user=Depends(get_current_user),
    date: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {"user_id": user["user_id"]}
    if date:
        query["date"] = date
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    if status:
        query["status"] = status
    appointments = await db.appointments.find(query, {"_id": 0}).sort(
        [("date", 1), ("start_time", 1)]
    ).to_list(10000)
    return appointments

@api_router.post("/appointments")
async def create_appointment(data: AppointmentCreate, user=Depends(get_current_user)):
    service = await db.services.find_one(
        {"service_id": data.service_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not service:
        raise HTTPException(404, "Servico nao encontrado")

    start_mins = time_to_minutes(data.start_time)
    end_mins = start_mins + service["duration_minutes"]
    end_time = minutes_to_time(end_mins)
    buffer = service.get("buffer_minutes", 0)

    existing = await db.appointments.find(
        {"user_id": user["user_id"], "date": data.date, "status": {"$nin": ["cancelled", "no_show"]}},
        {"_id": 0}
    ).to_list(1000)

    for apt in existing:
        apt_start = time_to_minutes(apt["start_time"])
        apt_end = time_to_minutes(apt["end_time"])
        if start_mins < (apt_end + buffer) and end_mins > (apt_start - buffer):
            raise HTTPException(409, f"Conflito de horario com agendamento as {apt['start_time']}")

    token = secrets.token_urlsafe(32)
    phone_norm = normalize_phone(data.client_phone)
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_price": service.get("price", 0),
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "client_phone_norm": phone_norm,
        "client_email": data.client_email or "",
        "date": data.date,
        "start_time": data.start_time,
        "end_time": end_time,
        "status": "scheduled",
        "notes": data.notes or "",
        "token": token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment)

    existing_client = await db.clients.find_one(
        {"user_id": user["user_id"], "$or": [{"phone": data.client_phone}, {"phone_norm": phone_norm}]},
        {"_id": 0}
    )
    if not existing_client and data.client_phone:
        await db.clients.insert_one({
            "client_id": f"cli_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "name": data.client_name,
            "phone": data.client_phone,
            "phone_norm": phone_norm,
            "email": data.client_email or "",
            "notes": "",
            "tags": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_visit": None
        })

    await mock_send_whatsapp(user["user_id"], appointment)
    result = await db.appointments.find_one({"appointment_id": appointment["appointment_id"]}, {"_id": 0})
    return result

@api_router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, request: Request, user=Depends(get_current_user)):
    body = await request.json()
    new_status = body.get("status")
    valid = ["scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"]
    if new_status not in valid:
        raise HTTPException(400, f"Status invalido. Use: {', '.join(valid)}")

    result = await db.appointments.update_one(
        {"appointment_id": appointment_id, "user_id": user["user_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Agendamento nao encontrado")

    if new_status == "completed":
        apt = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
        if apt:
            await db.clients.update_one(
                {"user_id": user["user_id"], "phone": apt["client_phone"]},
                {"$set": {"last_visit": datetime.now(timezone.utc).isoformat()}}
            )

    updated = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    return updated

@api_router.delete("/appointments/{appointment_id}")
async def cancel_appointment(appointment_id: str, user=Depends(get_current_user)):
    result = await db.appointments.update_one(
        {"appointment_id": appointment_id, "user_id": user["user_id"]},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Agendamento nao encontrado")
    return {"message": "Agendamento cancelado"}


# ==================== AVAILABILITY ROUTES ====================

@api_router.get("/availability")
async def get_availability(user=Depends(get_current_user)):
    rules = await db.availability_rules.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    breaks_list = await db.breaks.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return {"rules": rules, "breaks": breaks_list}

@api_router.post("/availability")
async def set_availability(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    rules = body.get("rules", [])
    breaks_data = body.get("breaks", [])

    await db.availability_rules.delete_many({"user_id": user["user_id"]})
    await db.breaks.delete_many({"user_id": user["user_id"]})

    for rule in rules:
        await db.availability_rules.insert_one({
            "rule_id": f"rule_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "day_of_week": rule["day_of_week"],
            "start_time": rule["start_time"],
            "end_time": rule["end_time"],
            "is_active": rule.get("is_active", True)
        })

    for brk in breaks_data:
        await db.breaks.insert_one({
            "break_id": f"brk_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "day_of_week": brk["day_of_week"],
            "start_time": brk["start_time"],
            "end_time": brk["end_time"]
        })

    return {"message": "Disponibilidade atualizada"}


# ==================== PUBLIC ROUTES ====================

@api_router.get("/public/{slug}")
async def get_public_profile(slug: str):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")

    public_data = {
        "user_id": user["user_id"],
        "name": user.get("name", ""),
        "business_name": user.get("business_name", ""),
        "business_type": user.get("business_type", ""),
        "bio": user.get("bio", ""),
        "picture": user.get("picture", ""),
        "cover_picture": user.get("cover_picture", ""),
        "address": user.get("address", ""),
        "slug": user.get("slug", ""),
        "phone": user.get("phone", ""),
        "social_links": user.get("social_links", {}),
        "featured_service_ids": user.get("featured_service_ids", [])
    }
    services = await db.services.find(
        {"user_id": user["user_id"], "active": True}, {"_id": 0}
    ).to_list(100)
    featured_ids = public_data.get("featured_service_ids") or []
    if featured_ids:
        featured_services = await db.services.find(
            {"user_id": user["user_id"], "active": True, "service_id": {"$in": featured_ids}}, {"_id": 0}
        ).to_list(100)
        order = {service_id: index for index, service_id in enumerate(featured_ids)}
        featured_services.sort(key=lambda svc: order.get(svc.get("service_id", ""), len(featured_ids)))
    else:
        featured_services = services[:3]
    return {"professional": public_data, "services": services, "featured_services": featured_services}

@api_router.get("/public/{slug}/slots")
async def get_public_slots(slug: str, date: str, service_id: str):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")
    slots = await calculate_slots(user["user_id"], date, service_id)
    return {"slots": slots, "date": date}

@api_router.post("/public/{slug}/book")
async def public_book(slug: str, data: AppointmentCreate, request: Request):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")

    service = await db.services.find_one(
        {"service_id": data.service_id, "user_id": user["user_id"], "active": True}, {"_id": 0}
    )
    if not service:
        raise HTTPException(404, "Servico nao encontrado")

    start_mins = time_to_minutes(data.start_time)
    end_mins = start_mins + service["duration_minutes"]
    end_time = minutes_to_time(end_mins)
    buffer = service.get("buffer_minutes", 0)

    existing = await db.appointments.find(
        {"user_id": user["user_id"], "date": data.date, "status": {"$nin": ["cancelled", "no_show"]}},
        {"_id": 0}
    ).to_list(1000)

    for apt in existing:
        apt_start = time_to_minutes(apt["start_time"])
        apt_end = time_to_minutes(apt["end_time"])
        if start_mins < (apt_end + buffer) and end_mins > (apt_start - buffer):
            raise HTTPException(409, "Este horario ja foi reservado. Escolha outro.")

    token = secrets.token_urlsafe(32)
    phone_norm = normalize_phone(data.client_phone)
    client_user = await get_optional_user(request)
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_price": service.get("price", 0),
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "client_phone_norm": phone_norm,
        "client_email": data.client_email or "",
        "date": data.date,
        "start_time": data.start_time,
        "end_time": end_time,
        "status": "scheduled",
        "notes": data.notes or "",
        "token": token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if client_user and client_user.get("role") == "client":
        appointment["client_user_id"] = client_user["user_id"]
    await db.appointments.insert_one(appointment)

    existing_client = await db.clients.find_one(
        {"user_id": user["user_id"], "$or": [{"phone": data.client_phone}, {"phone_norm": phone_norm}]},
        {"_id": 0}
    )
    if not existing_client and data.client_phone:
        await db.clients.insert_one({
            "client_id": f"cli_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "name": data.client_name,
            "phone": data.client_phone,
            "phone_norm": phone_norm,
            "email": data.client_email or "",
            "notes": "",
            "tags": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_visit": None
        })

    await mock_send_whatsapp(user["user_id"], appointment)
    result = await db.appointments.find_one({"appointment_id": appointment["appointment_id"]}, {"_id": 0})
    return result


# ==================== APPOINTMENT TOKEN ROUTES ====================

@api_router.get("/appointment/manage/{token}")
async def get_appointment_by_token(token: str):
    apt = await db.appointments.find_one({"token": token}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Agendamento nao encontrado")
    user = await db.users.find_one({"user_id": apt["user_id"]}, {"_id": 0})
    professional = {
        "name": user.get("name", ""),
        "business_name": user.get("business_name", ""),
        "address": user.get("address", ""),
        "phone": user.get("phone", ""),
        "slug": user.get("slug", ""),
        "cancellation_policy_hours": user.get("cancellation_policy_hours", 6)
    } if user else {}
    return {"appointment": apt, "professional": professional}

@api_router.post("/appointment/manage/{token}/confirm")
async def confirm_by_token(token: str):
    apt = await db.appointments.find_one({"token": token}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Agendamento nao encontrado")
    raise HTTPException(403, "Apenas o profissional pode confirmar o agendamento")

@api_router.post("/appointment/manage/{token}/cancel")
async def cancel_by_token(token: str):
    apt = await db.appointments.find_one({"token": token}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Agendamento nao encontrado")
    if apt["status"] in ["cancelled", "completed"]:
        raise HTTPException(400, "Este agendamento nao pode ser cancelado")

    user = await db.users.find_one({"user_id": apt["user_id"]}, {"_id": 0})
    policy_hours = user.get("cancellation_policy_hours", 6) if user else 6
    apt_datetime_str = f"{apt['date']}T{apt['start_time']}:00"
    apt_datetime = datetime.fromisoformat(apt_datetime_str).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    hours_until = (apt_datetime - now).total_seconds() / 3600

    if hours_until < policy_hours:
        raise HTTPException(400, f"Cancelamento permitido ate {policy_hours}h antes do horario")

    await db.appointments.update_one(
        {"token": token},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Agendamento cancelado", "status": "cancelled"}


# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    today_apts = await db.appointments.find(
        {"user_id": user["user_id"], "date": today, "status": {"$nin": ["cancelled"]}},
        {"_id": 0}
    ).sort("start_time", 1).to_list(100)

    total_today = len(today_apts)
    confirmed = len([a for a in today_apts if a["status"] in ["confirmed", "arrived", "in_progress"]])
    completed = len([a for a in today_apts if a["status"] == "completed"])

    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    month_end = datetime.now(timezone.utc).strftime("%Y-%m-31")
    month_apts = await db.appointments.find(
        {"user_id": user["user_id"], "date": {"$gte": month_start, "$lte": month_end}, "status": "completed"},
        {"_id": 0}
    ).to_list(10000)
    revenue = sum(a.get("service_price", 0) for a in month_apts)

    if start_date and end_date and start_date > end_date:
        start_date, end_date = end_date, start_date
    period_start = start_date or month_start
    period_end = end_date or month_end

    period_apts = await db.appointments.find(
        {"user_id": user["user_id"], "date": {"$gte": period_start, "$lte": period_end}},
        {"_id": 0}
    ).to_list(10000)
    period_active = [a for a in period_apts if a["status"] != "cancelled"]
    total_period = len(period_active)
    confirmed_period = len([a for a in period_active if a["status"] in ["confirmed", "arrived", "in_progress", "completed"]])
    no_show_period = len([a for a in period_active if a["status"] == "no_show"])
    completed_period = len([a for a in period_active if a["status"] == "completed"])
    revenue_period = sum(a.get("service_price", 0) for a in period_active if a["status"] == "completed")
    ticket_avg = (revenue_period / completed_period) if completed_period > 0 else 0
    confirmation_rate = (confirmed_period / total_period) if total_period > 0 else 0
    no_show_rate = (no_show_period / total_period) if total_period > 0 else 0

    total_clients = await db.clients.count_documents({"user_id": user["user_id"]})

    upcoming = await db.appointments.find(
        {"user_id": user["user_id"], "date": {"$gte": today}, "status": {"$nin": ["cancelled", "completed", "no_show"]}},
        {"_id": 0}
    ).sort([("date", 1), ("start_time", 1)]).to_list(5)

    return {
        "today_appointments": today_apts,
        "total_today": total_today,
        "confirmed": confirmed,
        "completed": completed,
        "revenue_month": revenue,
        "period_start": period_start,
        "period_end": period_end,
        "total_period": total_period,
        "confirmed_period": confirmed_period,
        "no_show_period": no_show_period,
        "completed_period": completed_period,
        "confirmation_rate": confirmation_rate,
        "no_show_rate": no_show_rate,
        "revenue_period": revenue_period,
        "ticket_avg": ticket_avg,
        "total_clients": total_clients,
        "upcoming": upcoming
    }


# ==================== WHATSAPP MOCK ROUTES ====================

async def mock_send_whatsapp(user_id: str, appointment: dict):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    bname = user.get("business_name", user.get("name", "")) if user else ""
    message = (
        f"Novo Agendamento - {bname}\n\n"
        f"Servico: {appointment['service_name']}\n"
        f"Data: {appointment['date']}\n"
        f"Horario: {appointment['start_time']} - {appointment['end_time']}\n"
        f"Cliente: {appointment['client_name']}\n"
        f"Telefone: {appointment['client_phone']}\n"
    )
    if appointment.get("notes"):
        message += f"Obs: {appointment['notes']}\n"

    msg_doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "appointment_id": appointment["appointment_id"],
        "phone": appointment["client_phone"],
        "message": message,
        "status": "sent",
        "type": "confirmation",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whatsapp_messages.insert_one(msg_doc)
    logger.info(f"[MOCK WhatsApp] Message sent to {appointment['client_phone']}")

@api_router.get("/whatsapp/log")
async def get_whatsapp_log(user=Depends(get_current_user)):
    messages = await db.whatsapp_messages.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return messages

@api_router.post("/whatsapp/send")
async def manual_whatsapp_send(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    msg_doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "appointment_id": body.get("appointment_id", ""),
        "phone": body.get("phone", ""),
        "message": body.get("message", ""),
        "status": "sent",
        "type": "manual",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whatsapp_messages.insert_one(msg_doc)
    return {"message": "Mensagem enviada (mock)", "message_id": msg_doc["message_id"]}


# ==================== MARKETPLACE ROUTES ====================

@api_router.get("/marketplace")
async def marketplace_search(
    city: Optional[str] = None,
    state: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    query = {"role": "professional"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
    if category:
        query["business_type"] = {"$regex": category, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}},
            {"business_type": {"$regex": search, "$options": "i"}}
        ]

    skip = (page - 1) * limit
    total = await db.users.count_documents(query)
    professionals = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0, "onboarding_completed": 0}
    ).skip(skip).limit(limit).to_list(limit)

    # Get service counts for each professional
    results = []
    for pro in professionals:
        svc_count = await db.services.count_documents({"user_id": pro["user_id"], "active": True})
        pro_data = {k: v for k, v in pro.items() if k != "password_hash"}
        pro_data["service_count"] = svc_count
        # Get active turbo offers count
        offer_count = await db.turbo_offers.count_documents({
            "user_id": pro["user_id"], "status": "active",
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        })
        pro_data["has_offers"] = offer_count > 0
        results.append(pro_data)

    return {"professionals": results, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/marketplace/categories")
async def marketplace_categories():
    pipeline = [
        {"$match": {"role": "professional", "business_type": {"$ne": ""}}},
        {"$group": {"_id": "$business_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cats = await db.users.aggregate(pipeline).to_list(50)
    return [{"name": c["_id"], "count": c["count"]} for c in cats if c["_id"]]

@api_router.get("/marketplace/cities")
async def marketplace_cities():
    pipeline = [
        {"$match": {"role": "professional", "city": {"$ne": ""}}},
        {"$group": {"_id": {"city": "$city", "state": "$state"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cities = await db.users.aggregate(pipeline).to_list(100)
    return [{"city": c["_id"]["city"], "state": c["_id"]["state"], "count": c["count"]} for c in cities if c["_id"].get("city")]


# ==================== CLIENT PANEL ROUTES ====================

@api_router.get("/client/dashboard")
async def client_dashboard(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    phone = user.get("phone", "")
    email = user.get("email", "")
    phone_digits = normalize_phone(phone)
    phone_pattern = build_phone_regex(phone_digits)

    query_conditions = []
    if phone_digits:
        query_conditions.append({"client_phone_norm": phone_digits})
        if phone_pattern:
            query_conditions.append({"client_phone": {"$regex": phone_pattern}})
    if email:
        query_conditions.append({"client_email": email})
    query_conditions.append({"client_user_id": user["user_id"]})

    if not query_conditions:
        return {"upcoming": [], "recent": [], "favorites_count": 0, "total_appointments": 0}

    match_query = {"$or": query_conditions}

    upcoming = await db.appointments.find(
        {**match_query, "date": {"$gte": today}, "status": {"$nin": ["cancelled", "no_show"]}},
        {"_id": 0}
    ).sort([("date", 1), ("start_time", 1)]).to_list(10)

    # Enrich with professional info
    for apt in upcoming:
        pro = await db.users.find_one({"user_id": apt["user_id"]}, {"_id": 0, "password_hash": 0})
        apt["professional"] = {"name": pro.get("name", ""), "business_name": pro.get("business_name", ""), "slug": pro.get("slug", "")} if pro else {}

    recent = await db.appointments.find(
        {**match_query, "date": {"$lt": today}},
        {"_id": 0}
    ).sort([("date", -1), ("start_time", -1)]).to_list(10)
    for apt in recent:
        pro = await db.users.find_one({"user_id": apt["user_id"]}, {"_id": 0, "password_hash": 0})
        apt["professional"] = {"name": pro.get("name", ""), "business_name": pro.get("business_name", ""), "slug": pro.get("slug", "")} if pro else {}

    fav_count = await db.favorites.count_documents({"client_user_id": user["user_id"]})
    total = await db.appointments.count_documents(match_query)

    return {"upcoming": upcoming, "recent": recent, "favorites_count": fav_count, "total_appointments": total}

@api_router.get("/client/appointments")
async def client_appointments(user=Depends(get_current_user), status: Optional[str] = None):
    phone = user.get("phone", "")
    email = user.get("email", "")
    phone_digits = normalize_phone(phone)
    phone_pattern = build_phone_regex(phone_digits)
    query_conditions = []
    if phone_digits:
        query_conditions.append({"client_phone_norm": phone_digits})
        if phone_pattern:
            query_conditions.append({"client_phone": {"$regex": phone_pattern}})
    if email:
        query_conditions.append({"client_email": email})
    query_conditions.append({"client_user_id": user["user_id"]})
    if not query_conditions:
        return []

    query = {"$or": query_conditions}
    if status:
        query["status"] = status

    appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(500)
    for apt in appointments:
        pro = await db.users.find_one({"user_id": apt["user_id"]}, {"_id": 0, "password_hash": 0})
        apt["professional"] = {"name": pro.get("name", ""), "business_name": pro.get("business_name", ""), "slug": pro.get("slug", "")} if pro else {}
    return appointments

@api_router.get("/client/favorites")
async def client_favorites(user=Depends(get_current_user)):
    favs = await db.favorites.find({"client_user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    results = []
    for fav in favs:
        pro = await db.users.find_one({"user_id": fav["professional_user_id"]}, {"_id": 0, "password_hash": 0})
        if pro:
            svc_count = await db.services.count_documents({"user_id": pro["user_id"], "active": True})
            pro_data = {k: v for k, v in pro.items() if k != "password_hash"}
            pro_data["service_count"] = svc_count
            results.append(pro_data)
    return results

@api_router.post("/client/favorites/{professional_id}")
async def add_favorite(professional_id: str, user=Depends(get_current_user)):
    existing = await db.favorites.find_one(
        {"client_user_id": user["user_id"], "professional_user_id": professional_id}, {"_id": 0}
    )
    if existing:
        return {"message": "Ja esta nos favoritos"}
    await db.favorites.insert_one({
        "favorite_id": f"fav_{uuid.uuid4().hex[:8]}",
        "client_user_id": user["user_id"],
        "professional_user_id": professional_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Adicionado aos favoritos"}

@api_router.delete("/client/favorites/{professional_id}")
async def remove_favorite(professional_id: str, user=Depends(get_current_user)):
    await db.favorites.delete_one(
        {"client_user_id": user["user_id"], "professional_user_id": professional_id}
    )
    return {"message": "Removido dos favoritos"}


# ==================== QUICK LINKS ROUTES ====================

@api_router.get("/quick-links")
async def list_quick_links(user=Depends(get_current_user)):
    links = await db.quick_links.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for link in links:
        svc = await db.services.find_one({"service_id": link["service_id"]}, {"_id": 0})
        link["service_name"] = svc["name"] if svc else "Servico removido"
        link["service_price"] = svc.get("price", 0) if svc else 0
    return links

@api_router.post("/quick-links")
async def create_quick_link(data: QuickLinkCreate, user=Depends(get_current_user)):
    svc = await db.services.find_one({"service_id": data.service_id, "user_id": user["user_id"]}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Servico nao encontrado")

    code = secrets.token_urlsafe(8)
    link = {
        "link_id": f"ql_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "slug": user.get("slug", ""),
        "service_id": data.service_id,
        "code": code,
        "discount_percent": min(data.discount_percent, 100),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=data.expires_hours)).isoformat(),
        "max_uses": data.max_uses,
        "current_uses": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.quick_links.insert_one(link)
    result = await db.quick_links.find_one({"link_id": link["link_id"]}, {"_id": 0})
    result["service_name"] = svc["name"]
    result["service_price"] = svc.get("price", 0)
    return result

@api_router.delete("/quick-links/{link_id}")
async def delete_quick_link(link_id: str, user=Depends(get_current_user)):
    await db.quick_links.delete_one({"link_id": link_id, "user_id": user["user_id"]})
    return {"message": "Link removido"}

@api_router.get("/ql/{code}")
async def get_quick_link_public(code: str):
    link = await db.quick_links.find_one({"code": code, "active": True}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link nao encontrado ou expirado")

    if link["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(410, "Este link expirou")
    if link["current_uses"] >= link["max_uses"]:
        raise HTTPException(410, "Este link ja atingiu o limite de usos")

    pro = await db.users.find_one({"user_id": link["user_id"]}, {"_id": 0, "password_hash": 0})
    svc = await db.services.find_one({"service_id": link["service_id"]}, {"_id": 0})

    original_price = svc.get("price", 0) if svc else 0
    discount_price = original_price * (1 - link["discount_percent"] / 100)

    return {
        "link": link,
        "professional": {
            "name": pro.get("name", ""), "business_name": pro.get("business_name", ""),
            "slug": pro.get("slug", ""), "picture": pro.get("picture", ""),
            "address": pro.get("address", "")
        } if pro else {},
        "service": svc,
        "original_price": original_price,
        "discount_price": round(discount_price, 2)
    }

@api_router.post("/ql/{code}/book")
async def book_via_quick_link(code: str, data: AppointmentCreate):
    link = await db.quick_links.find_one({"code": code, "active": True}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link nao encontrado")
    if link["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(410, "Este link expirou")
    if link["current_uses"] >= link["max_uses"]:
        raise HTTPException(410, "Limite de usos atingido")

    slug = link.get("slug", "")
    user = await db.users.find_one({"user_id": link["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")

    svc = await db.services.find_one({"service_id": link["service_id"]}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Servico nao encontrado")

    start_mins = time_to_minutes(data.start_time)
    end_mins = start_mins + svc["duration_minutes"]
    end_time = minutes_to_time(end_mins)
    buffer = svc.get("buffer_minutes", 0)

    existing = await db.appointments.find(
        {"user_id": user["user_id"], "date": data.date, "status": {"$nin": ["cancelled", "no_show"]}}, {"_id": 0}
    ).to_list(1000)
    for apt in existing:
        apt_s = time_to_minutes(apt["start_time"])
        apt_e = time_to_minutes(apt["end_time"])
        if start_mins < (apt_e + buffer) and end_mins > (apt_s - buffer):
            raise HTTPException(409, "Horario ja reservado")

    discount_price = svc.get("price", 0) * (1 - link["discount_percent"] / 100)
    token = secrets.token_urlsafe(32)
    apt_doc = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "service_id": link["service_id"],
        "service_name": svc["name"],
        "service_price": round(discount_price, 2),
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "client_email": data.client_email or "",
        "date": data.date,
        "start_time": data.start_time,
        "end_time": end_time,
        "status": "scheduled",
        "notes": data.notes or f"Via link rapido (desconto {link['discount_percent']}%)",
        "token": token,
        "quick_link_code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(apt_doc)
    await db.quick_links.update_one({"code": code}, {"$inc": {"current_uses": 1}})
    await mock_send_whatsapp(user["user_id"], apt_doc)

    result = await db.appointments.find_one({"appointment_id": apt_doc["appointment_id"]}, {"_id": 0})
    return result


# ==================== TURBO OFFERS ROUTES ====================

@api_router.get("/turbo-offers")
async def list_turbo_offers(user=Depends(get_current_user)):
    offers = await db.turbo_offers.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return offers

@api_router.post("/turbo-offers")
async def create_turbo_offer(data: TurboOfferCreate, user=Depends(get_current_user)):
    svc = await db.services.find_one({"service_id": data.service_id, "user_id": user["user_id"]}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Servico nao encontrado")

    original_price = svc.get("price", 0)
    offer_price = round(original_price * (1 - data.discount_percent / 100), 2)
    end_mins = time_to_minutes(data.start_time) + svc["duration_minutes"]

    offer = {
        "offer_id": f"turbo_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "slug": user.get("slug", ""),
        "service_id": data.service_id,
        "service_name": svc["name"],
        "date": data.date,
        "start_time": data.start_time,
        "end_time": minutes_to_time(end_mins),
        "discount_percent": data.discount_percent,
        "original_price": original_price,
        "offer_price": offer_price,
        "status": "active",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=data.expires_hours)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.turbo_offers.insert_one(offer)
    result = await db.turbo_offers.find_one({"offer_id": offer["offer_id"]}, {"_id": 0})
    return result

@api_router.delete("/turbo-offers/{offer_id}")
async def delete_turbo_offer(offer_id: str, user=Depends(get_current_user)):
    await db.turbo_offers.delete_one({"offer_id": offer_id, "user_id": user["user_id"]})
    return {"message": "Oferta removida"}

@api_router.get("/turbo-offers/public/{slug}")
async def get_public_turbo_offers(slug: str):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")

    now_iso = datetime.now(timezone.utc).isoformat()
    offers = await db.turbo_offers.find(
        {"user_id": user["user_id"], "status": "active", "expires_at": {"$gt": now_iso}},
        {"_id": 0}
    ).sort("date", 1).to_list(50)
    return {
        "offers": offers,
        "professional": {
            "name": user.get("name", ""), "business_name": user.get("business_name", ""),
            "slug": user.get("slug", ""), "picture": user.get("picture", "")
        }
    }

@api_router.post("/turbo-offers/{offer_id}/book")
async def book_turbo_offer(offer_id: str, request: Request):
    body = await request.json()
    offer = await db.turbo_offers.find_one({"offer_id": offer_id, "status": "active"}, {"_id": 0})
    if not offer:
        raise HTTPException(404, "Oferta nao encontrada ou ja reservada")
    if offer["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(410, "Esta oferta expirou")

    user = await db.users.find_one({"user_id": offer["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")

    # Check conflict
    existing = await db.appointments.find(
        {"user_id": offer["user_id"], "date": offer["date"], "status": {"$nin": ["cancelled", "no_show"]}}, {"_id": 0}
    ).to_list(1000)
    start_mins = time_to_minutes(offer["start_time"])
    end_mins = time_to_minutes(offer["end_time"])
    for apt in existing:
        apt_s = time_to_minutes(apt["start_time"])
        apt_e = time_to_minutes(apt["end_time"])
        if start_mins < apt_e and end_mins > apt_s:
            raise HTTPException(409, "Horario ja reservado")

    token = secrets.token_urlsafe(32)
    apt_doc = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": offer["user_id"],
        "service_id": offer["service_id"],
        "service_name": offer["service_name"],
        "service_price": offer["offer_price"],
        "client_name": body.get("client_name", ""),
        "client_phone": body.get("client_phone", ""),
        "client_email": body.get("client_email", ""),
        "date": offer["date"],
        "start_time": offer["start_time"],
        "end_time": offer["end_time"],
        "status": "scheduled",
        "notes": f"Turbo Preenchimento (-{offer['discount_percent']}%)",
        "token": token,
        "turbo_offer_id": offer_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(apt_doc)
    await db.turbo_offers.update_one({"offer_id": offer_id}, {"$set": {"status": "booked"}})
    await mock_send_whatsapp(offer["user_id"], apt_doc)

    result = await db.appointments.find_one({"appointment_id": apt_doc["appointment_id"]}, {"_id": 0})
    return result


# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Click Agenda API", "version": "1.0.0"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True, background=True)
    await db.users.create_index("email", unique=True, background=True, sparse=True)
    await db.users.create_index("slug", unique=True, background=True, sparse=True)
    await db.appointments.create_index([("user_id", 1), ("date", 1)], background=True)
    await db.appointments.create_index("token", unique=True, background=True, sparse=True)
    await db.services.create_index([("user_id", 1)], background=True)
    await db.clients.create_index([("user_id", 1)], background=True)
    await db.availability_rules.create_index([("user_id", 1)], background=True)
    await db.user_sessions.create_index("session_token", background=True)
    await db.quick_links.create_index("code", unique=True, background=True, sparse=True)
    await db.quick_links.create_index([("user_id", 1)], background=True)
    await db.turbo_offers.create_index([("user_id", 1)], background=True)
    await db.turbo_offers.create_index([("slug", 1), ("status", 1)], background=True)
    await db.favorites.create_index([("client_user_id", 1)], background=True)
    await db.users.create_index([("role", 1), ("city", 1)], background=True)
    await db.auth_events.create_index([("user_id", 1), ("created_at", -1)], background=True)
    logger.info("Click Agenda API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
