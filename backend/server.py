from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))

app = FastAPI()
api_router = APIRouter(prefix="/api")

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

async def create_session(user_id: str, response: Response) -> str:
    session_token = generate_session_token()
    await db.user_sessions.insert_one({
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
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
async def register(data: UserRegister, response: Response):
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
        "business_name": data.business_name or "",
        "business_type": "",
        "address": "",
        "city": "",
        "state": "",
        "min_advance_hours": 2,
        "cancellation_policy_hours": 6,
        "onboarding_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)

    if role == "professional":
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

        await db.breaks.insert_one({
            "break_id": f"brk_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "day_of_week": -1,
            "start_time": "12:00",
            "end_time": "13:00"
        })

    session_token = await create_session(user_id, response)
    user_data = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"user": user_data, "session_token": session_token}


@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Email ou senha incorretos")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha incorretos")

    session_token = await create_session(user["user_id"], response)
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
            "phone": "",
            "bio": "",
            "picture": google_data.get("picture", ""),
            "business_name": "",
            "business_type": "",
            "address": "",
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
    else:
        user_id = user["user_id"]
        if google_data.get("picture"):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"picture": google_data["picture"]}}
            )
            user["picture"] = google_data["picture"]

    session_token = await create_session(user_id, response)
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
    response.delete_cookie(key="session_token", path="/", samesite="none", secure=True)
    return {"message": "Logout realizado"}


# ==================== PROFILE ROUTES ====================

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "slug" in update_data:
        existing = await db.users.find_one(
            {"slug": update_data["slug"], "user_id": {"$ne": user["user_id"]}},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(400, "Este link ja esta em uso")

    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})

    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {k: v for k, v in updated.items() if k != "password_hash"}


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
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_price": service.get("price", 0),
        "client_name": data.client_name,
        "client_phone": data.client_phone,
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
        {"user_id": user["user_id"], "phone": data.client_phone}, {"_id": 0}
    )
    if not existing_client and data.client_phone:
        await db.clients.insert_one({
            "client_id": f"cli_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "name": data.client_name,
            "phone": data.client_phone,
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
        "address": user.get("address", ""),
        "slug": user.get("slug", ""),
        "phone": user.get("phone", "")
    }
    services = await db.services.find(
        {"user_id": user["user_id"], "active": True}, {"_id": 0}
    ).to_list(100)
    return {"professional": public_data, "services": services}

@api_router.get("/public/{slug}/slots")
async def get_public_slots(slug: str, date: str, service_id: str):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")
    slots = await calculate_slots(user["user_id"], date, service_id)
    return {"slots": slots, "date": date}

@api_router.post("/public/{slug}/book")
async def public_book(slug: str, data: AppointmentCreate):
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
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user["user_id"],
        "service_id": data.service_id,
        "service_name": service["name"],
        "service_price": service.get("price", 0),
        "client_name": data.client_name,
        "client_phone": data.client_phone,
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
        {"user_id": user["user_id"], "phone": data.client_phone}, {"_id": 0}
    )
    if not existing_client and data.client_phone:
        await db.clients.insert_one({
            "client_id": f"cli_{uuid.uuid4().hex[:8]}",
            "user_id": user["user_id"],
            "name": data.client_name,
            "phone": data.client_phone,
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
    if apt["status"] == "cancelled":
        raise HTTPException(400, "Este agendamento ja foi cancelado")
    await db.appointments.update_one(
        {"token": token},
        {"$set": {"status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Agendamento confirmado!", "status": "confirmed"}

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
async def get_dashboard_stats(user=Depends(get_current_user)):
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
    logger.info("Click Agenda API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
