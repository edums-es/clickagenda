from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel
from typing import List, Literal, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import secrets
import httpx
import re
import boto3
from botocore.config import Config as BotocoreConfig
import resend
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pytz

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))

app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== EMAIL (RESEND) ====================
resend.api_key = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "noreply@salaozap.com.br")
EMAIL_ENABLED = bool(os.environ.get("RESEND_API_KEY", ""))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# ==================== CLOUDFLARE R2 ====================
R2_ENABLED = all([
    os.environ.get("R2_ACCOUNT_ID"),
    os.environ.get("R2_ACCESS_KEY_ID"),
    os.environ.get("R2_SECRET_ACCESS_KEY"),
])

if R2_ENABLED:
    r2_client = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=BotocoreConfig(signature_version="s3v4"),
        region_name="auto",
    )
    R2_BUCKET = os.environ.get("R2_BUCKET_NAME", "salaozap-uploads")
    R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
else:
    r2_client = None
    R2_BUCKET = ""
    R2_PUBLIC_URL = ""


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
    plan: Optional[str] = None
    onboarding_completed: Optional[bool] = None

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

class ReviewCreate(BaseModel):
    appointment_id: str
    rating: int  # 1 a 5
    comment: Optional[str] = ""

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# ==================== PLAN LIMITS ====================

PLAN_LIMITS = {
    "free":   {"services": 3,  "quick_links": 2, "turbo_offers": 1},
    "pro":    {"services": 50, "quick_links": 20, "turbo_offers": 10},
    "studio": {"services": -1, "quick_links": -1, "turbo_offers": -1},  # -1 = ilimitado
}

async def check_plan_limit(user: dict, resource: str, collection_name: str) -> None:
    """Lança HTTPException 403 se o usuário atingiu o limite do plano."""
    plan = user.get("plan", "free")
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get(resource, 0)
    if limit == -1:
        return  # Ilimitado
    count = await db[collection_name].count_documents({"user_id": user["user_id"]})
    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Limite do plano {plan.upper()} atingido para {resource}. Faça upgrade para continuar."
        )


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

import urllib.parse

def build_whatsapp_link(phone: str, message: str) -> Optional[str]:
    """Gera link wa.me com mensagem formatada"""
    phone_clean = re.sub(r'\D', '', phone or '')
    if not phone_clean:
        return None
    if not phone_clean.startswith('55'):
        phone_clean = f"55{phone_clean}"
    encoded = urllib.parse.quote(message)
    return f"https://wa.me/{phone_clean}?text={encoded}"
def build_client_to_professional_message(appointment: dict, professional_name: str) -> str:
    """Mensagem do CLIENTE para o PROFISSIONAL apos agendar"""
    notes_str = f"📝 *Observações:* {appointment['notes']}\n" if appointment.get('notes') else ""
    return (
        f"Olá, {professional_name}!\n\n"
        f"Gostaria de confirmar meu agendamento realizado via SalãoZap.\n\n"
        f"📌 *Detalhes do Agendamento:*\n"
        f"▪️ *Serviço:* {appointment['service_name']}\n"
        f"▪️ *Data:* {appointment['date']}\n"
        f"▪️ *Horário:* {appointment['start_time']} às {appointment['end_time']}\n\n"
        f"👤 *Meus Dados:*\n"
        f"▪️ *Nome:* {appointment['client_name']}\n"
        f"▪️ *Contato:* {appointment['client_phone']}\n"
        f"{notes_str}\n"
        f"Agradeço desde já! ✅"
    )

def build_professional_to_client_message(appointment: dict, professional_name: str) -> str:
    """Mensagem do PROFISSIONAL para o CLIENTE apos agendar manualmente"""
    return (
        f"Olá, {appointment['client_name']}!\n\n"
        f"Seu agendamento foi confirmado com sucesso. ✅\n\n"
        f"📌 *Detalhes da Reserva:*\n"
        f"▪️ *Serviço:* {appointment['service_name']}\n"
        f"▪️ *Data:* {appointment['date']}\n"
        f"▪️ *Horário:* {appointment['start_time']} às {appointment['end_time']}\n\n"
        f"Te aguardamos!"
    )

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
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
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
    min_advance = user.get("min_advance_hours", 0) if user else 0

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
    BR_TZ = pytz.timezone("America/Sao_Paulo")
    now_br = datetime.now(BR_TZ)
    cutoff = now_br + timedelta(hours=min_advance)

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
                    slot_unaware = date_obj.replace(
                        hour=slot_start // 60,
                        minute=slot_start % 60
                    )
                    slot_dt = BR_TZ.localize(slot_unaware)
                    
                    if slot_dt > cutoff:
                        slots.append({
                            "start_time": minutes_to_time(slot_start),
                            "end_time": minutes_to_time(slot_end)
                        })

            current += 30

    return sorted(slots, key=lambda s: s["start_time"])


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister, response: Response):
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
        "min_advance_hours": 0,
        "cancellation_policy_hours": 6,
        "onboarding_completed": False,
        "plan": "free",
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
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin, response: Response):
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
            "min_advance_hours": 0,
            "cancellation_policy_hours": 6,
            "onboarding_completed": False,
            "plan": "free",
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


@api_router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: PasswordResetRequest):
    neutral = {"message": "Se o e-mail estiver cadastrado, você receberá um link em breve."}
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        return neutral

    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "email": data.email,
        "expires_at": expires_at,
        "used": False
    })

    reset_link = f"{FRONTEND_URL}/redefinir-senha?token={token}"
    if EMAIL_ENABLED:
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#6366f1;">Redefinição de senha — SalãoZap</h2>
          <p>Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:</p>
          <p><a href="{reset_link}" style="background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Redefinir minha senha</a></p>
          <p style="color:#888;font-size:12px;">Este link expira em 1 hora. Se você não solicitou, ignore este e-mail.</p>
        </div>
        """
        try:
            resend.Emails.send({
                "from": EMAIL_FROM,
                "to": [data.email],
                "subject": "Redefinição de senha — SalãoZap",
                "html": html,
            })
        except Exception as exc:
            logger.warning(f"[EMAIL] Falha ao enviar reset de senha: {exc}")
    else:
        logger.info(f"[EMAIL DISABLED] Reset link (dev): {reset_link}")

    return neutral


@api_router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: PasswordResetConfirm):
    now = datetime.now(timezone.utc)
    reset_doc = await db.password_reset_tokens.find_one(
        {"token": data.token, "used": False, "expires_at": {"$gt": now}},
        {"_id": 0}
    )
    if not reset_doc:
        raise HTTPException(400, "Token inválido ou expirado")

    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"user_id": reset_doc["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    await db.password_reset_tokens.update_one(
        {"token": data.token},
        {"$set": {"used": True}}
    )
    return {"message": "Senha redefinida com sucesso"}


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

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Limite: 5MB")

    if R2_ENABLED:
        try:
            r2_client.put_object(
                Bucket=R2_BUCKET,
                Key=saved_name,
                Body=content,
                ContentType=file.content_type
            )
            public_url = f"{R2_PUBLIC_URL}/{saved_name}"
            return {"url": public_url}
        except Exception as exc:
            logger.error(f"[R2] Falha ao fazer upload: {exc}")
            raise HTTPException(500, "Erro ao fazer upload da imagem")
    else:
        # Fallback: salvar em disco local (apenas desenvolvimento)
        saved_path = UPLOAD_DIR / saved_name
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
    await check_plan_limit(user, "services", "services")
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
    await asyncio.gather(
        send_confirmation_email(appointment, user, "client"),
        send_confirmation_email(appointment, user, "professional"),
        return_exceptions=True
    )
    
    professional_name = user.get('business_name') or user.get('name', '')
    msg = build_professional_to_client_message(appointment, professional_name)
    whatsapp_link = build_whatsapp_link(data.client_phone, msg)
    
    result = await db.appointments.find_one({"appointment_id": appointment["appointment_id"]}, {"_id": 0})
    result['whatsapp_link'] = whatsapp_link
    result['whatsapp_target'] = 'client'
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
@limiter.limit("10/minute")
async def public_book(slug: str, request: Request, data: AppointmentCreate):
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
    await asyncio.gather(
        send_confirmation_email(appointment, user, "client"),
        send_confirmation_email(appointment, user, "professional"),
        return_exceptions=True
    )
    
    professional_phone = user.get('phone', '')
    professional_name = user.get('business_name') or user.get('name', '')
    msg = build_client_to_professional_message(appointment, professional_name)
    whatsapp_link = build_whatsapp_link(professional_phone, msg)
    
    result = await db.appointments.find_one({"appointment_id": appointment["appointment_id"]}, {"_id": 0})
    result['whatsapp_link'] = whatsapp_link
    result['whatsapp_target'] = 'professional'
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


async def send_confirmation_email(
    appointment: dict,
    professional: dict,
    recipient: Literal["client", "professional"]
) -> None:
    """Envia e-mail de confirmação de agendamento via Resend."""
    if not EMAIL_ENABLED:
        logger.warning("[EMAIL DISABLED] RESEND_API_KEY não configurado. E-mail não enviado.")
        return

    if recipient == "client":
        to_email = appointment.get("client_email", "")
        if not to_email:
            logger.warning("[EMAIL] client_email vazio — e-mail ao cliente não enviado.")
            return
        subject = f"Confirmação de agendamento — {appointment.get('service_name', '')}"
        recipient_name = appointment.get("client_name", "Cliente")
    else:
        to_email = professional.get("email", "")
        if not to_email:
            logger.warning("[EMAIL] E-mail do profissional vazio — e-mail ao profissional não enviado.")
            return
        subject = f"Novo agendamento recebido — {appointment.get('service_name', '')}"
        recipient_name = professional.get("business_name") or professional.get("name", "Profissional")

    token = appointment.get("token", "")
    manage_link = f"{FRONTEND_URL}/agendamento/{token}" if token else ""

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1;">SalãoZap — Agendamento Confirmado ✅</h2>
      <p>Olá, <strong>{recipient_name}</strong>!</p>
      <p>Seu agendamento foi {'confirmado' if recipient == 'client' else 'recebido'} com sucesso.</p>
      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr><td style="padding:8px; background:#f4f4f4; font-weight:bold;">Serviço</td>
            <td style="padding:8px;">{appointment.get('service_name', '')}</td></tr>
        <tr><td style="padding:8px; background:#f4f4f4; font-weight:bold;">Data</td>
            <td style="padding:8px;">{appointment.get('date', '')}</td></tr>
        <tr><td style="padding:8px; background:#f4f4f4; font-weight:bold;">Horário</td>
            <td style="padding:8px;">{appointment.get('start_time', '')} – {appointment.get('end_time', '')}</td></tr>
        <tr><td style="padding:8px; background:#f4f4f4; font-weight:bold;">Cliente</td>
            <td style="padding:8px;">{appointment.get('client_name', '')}</td></tr>
        <tr><td style="padding:8px; background:#f4f4f4; font-weight:bold;">Telefone</td>
            <td style="padding:8px;">{appointment.get('client_phone', '')}</td></tr>
      </table>
      {'<p><a href="' + manage_link + '" style="background:#6366f1;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Gerenciar Agendamento</a></p>' if manage_link else ''}
      <p style="color:#888; font-size:12px;">Agendado via SalãoZap</p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        logger.info(f"[EMAIL] Confirmação enviada para {to_email} ({recipient})")
    except Exception as exc:
        logger.warning(f"[EMAIL] Falha ao enviar e-mail para {to_email}: {exc}")


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


# ==================== REVIEWS ROUTES ====================

@api_router.post("/reviews/{token}")
async def create_review(token: str, data: ReviewCreate):
    apt = await db.appointments.find_one({"token": token}, {"_id": 0})
    if not apt:
        raise HTTPException(404, "Agendamento nao encontrado")
    if apt["status"] != "completed":
        raise HTTPException(400, "Agendamento ainda nao concluido")
    if apt["appointment_id"] != data.appointment_id:
        raise HTTPException(400, "Token invalido para este agendamento")

    existing = await db.reviews.find_one({"appointment_id": data.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Avaliacao ja enviada para este agendamento")

    review = {
        "review_id": f"rev_{uuid.uuid4().hex[:8]}",
        "appointment_id": data.appointment_id,
        "user_id": apt["user_id"],
        "client_name": apt["client_name"],
        "service_name": apt["service_name"],
        "rating": max(1, min(5, data.rating)),
        "comment": data.comment[:300] if data.comment else "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reviews.insert_one(review)
    return {"message": "Avaliacao enviada com sucesso"}

@api_router.get("/reviews")
async def list_reviews(user=Depends(get_current_user)):
    reviews = await db.reviews.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    total = len(reviews)
    avg = sum(r["rating"] for r in reviews) / total if total > 0 else 0
    return {"reviews": reviews, "average": round(avg, 1), "total": total}

@api_router.get("/public/{slug}/reviews")
async def get_public_reviews(slug: str):
    user = await db.users.find_one({"slug": slug}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Profissional nao encontrado")
    
    reviews = await db.reviews.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = await db.reviews.aggregate(pipeline).to_list(1)
    
    avg = stats[0]["avg"] if stats else 0
    total = stats[0]["count"] if stats else 0
    
    return {"reviews": reviews, "average": round(avg, 1), "total": total}



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
    await check_plan_limit(user, "quick_links", "quick_links")
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
@limiter.limit("10/minute")
async def book_via_quick_link(code: str, request: Request, data: AppointmentCreate):
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
    await asyncio.gather(
        send_confirmation_email(apt_doc, user, "client"),
        send_confirmation_email(apt_doc, user, "professional"),
        return_exceptions=True
    )

    result = await db.appointments.find_one({"appointment_id": apt_doc["appointment_id"]}, {"_id": 0})
    return result


# ==================== TURBO OFFERS ROUTES ====================

@api_router.get("/turbo-offers")
async def list_turbo_offers(user=Depends(get_current_user)):
    offers = await db.turbo_offers.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return offers

@api_router.post("/turbo-offers")
async def create_turbo_offer(data: TurboOfferCreate, user=Depends(get_current_user)):
    await check_plan_limit(user, "turbo_offers", "turbo_offers")
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
@limiter.limit("10/minute")
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
    await asyncio.gather(
        send_confirmation_email(apt_doc, user, "client"),
        send_confirmation_email(apt_doc, user, "professional"),
        return_exceptions=True
    )

    result = await db.appointments.find_one({"appointment_id": apt_doc["appointment_id"]}, {"_id": 0})
    return result


# ==================== WHATSAPP & IA ====================

from openai import AsyncOpenAI

EVOLUTION_API_URL = os.environ.get("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_GLOBAL_API_KEY = os.environ.get("EVOLUTION_GLOBAL_API_KEY", "")

class WhatsappConfigUpdate(BaseModel):
    is_active: bool
    ai_prompt: str

@api_router.get("/whatsapp/config")
async def get_whatsapp_config(user=Depends(get_current_user)):
    user_id = user["user_id"]
    config = await db.whatsapp_config.find_one({"user_id": user_id}, {"_id": 0})
    if not config:
        config = {
            "user_id": user_id,
            "instance_name": f"salaozap_{user_id.replace('-', '')}",
            "is_active": False,
            "ai_prompt": "Você é um assistente virtual de agendamento amigável e direto. Ajude o cliente a decidir o serviço e mostre horários. Sempre confirme data e hora.",
            "status": "DISCONNECTED"
        }
        await db.whatsapp_config.insert_one(config)
    return config

@api_router.put("/whatsapp/config")
async def update_whatsapp_config(data: WhatsappConfigUpdate, user=Depends(get_current_user)):
    await db.whatsapp_config.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"is_active": data.is_active, "ai_prompt": data.ai_prompt}}
    )
    return await get_whatsapp_config(user)

@api_router.post("/whatsapp/connect")
async def connect_whatsapp(user=Depends(get_current_user)):
    config = await get_whatsapp_config(user)
    instance_name = config["instance_name"]
    
    headers = {"apikey": EVOLUTION_GLOBAL_API_KEY, "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Verifica se instancia ja existe
        try:
            res_state = await client.get(f"{EVOLUTION_API_URL}/instance/connectionState/{instance_name}", headers=headers)
            exists = res_state.status_code == 200
        except Exception:
            exists = False

        if not exists:
            create_payload = {
                "instanceName": instance_name,
                "token": secrets.token_hex(16),
                "qrcode": True,
                "integration": "WHATSAPP-BAILEYS"
            }
            try:
                res_create = await client.post(f"{EVOLUTION_API_URL}/instance/create", json=create_payload, headers=headers)
                if res_create.status_code in [401, 403]:
                    logger.error("API Key recusada pela Evolution.")
                    raise HTTPException(500, "Evolution API recusou a chave. Verifique o EVOLUTION_GLOBAL_API_KEY.")
            except Exception as e:
                logger.error(f"Erro ao criar instancia Evolution: {e}")
                # Pode ter criado com sucesso no timeout, entao nao vamos crashar e seguimos.
                
        # Configurar Webhook sempre para forcar update
        try:
            backend_url = os.environ.get("BACKEND_PUBLIC_URL", FRONTEND_URL.replace(":3000", ":8000"))
            webhook_payload = {
                "webhook": {
                    "enabled": True,
                    "url": f"{backend_url}/api/whatsapp/webhook/{user['user_id']}",
                    "byEvents": False,
                    "base64": False,
                    "events": ["MESSAGES_UPSERT"],
                    "headers": {
                        "Bypass-Tunnel-Reminder": "true"
                    }
                }
            }
            await client.post(f"{EVOLUTION_API_URL}/webhook/set/{instance_name}", json=webhook_payload, headers=headers)
        except Exception as e:
            logger.error(f"Erro ao configurar webhook: {e}")

        # Buscar QR Code
        try:
            res_connect = await client.get(f"{EVOLUTION_API_URL}/instance/connect/{instance_name}", headers=headers)
            if res_connect.status_code == 200:
                data = res_connect.json()
                if "base64" in data:
                    return {"status": "AWAITING_QR", "qr_code": data.get("base64")}
                else:
                    return {"status": "AWAITING_QR", "qr_code": ""}
            else:
                raise Exception("Erro HTTP ao buscar base64")
        except Exception as e:
            logger.error(f"Erro ao obter QR da Evolution: {e}")
            raise HTTPException(500, "A Evolution API nao devolveu o QR Code a tempo. Tente gerar novamente em 5 segundos.")

@api_router.get("/whatsapp/instance-status")
async def get_whatsapp_instance_status(user=Depends(get_current_user)):
    config = await get_whatsapp_config(user)
    instance_name = config["instance_name"]
    
    headers = {"apikey": EVOLUTION_GLOBAL_API_KEY}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{EVOLUTION_API_URL}/instance/connectionState/{instance_name}", headers=headers)
            if res.status_code == 200:
                state = res.json().get("instance", {}).get("state", "DISCONNECTED")
                return {"status": state}
            return {"status": "DISCONNECTED"}
        except:
            return {"status": "DISCONNECTED"}

@api_router.delete("/whatsapp/disconnect")
async def disconnect_whatsapp(user=Depends(get_current_user)):
    config = await get_whatsapp_config(user)
    instance_name = config["instance_name"]
    headers = {"apikey": EVOLUTION_GLOBAL_API_KEY}
    async with httpx.AsyncClient() as client:
        await client.delete(f"{EVOLUTION_API_URL}/instance/logout/{instance_name}", headers=headers)
    return {"message": "Desconectado com sucesso"}


async def send_whatsapp_message(instance_name: str, phone: str, text: str):
    headers = {"apikey": EVOLUTION_GLOBAL_API_KEY, "Content-Type": "application/json"}
    payload = {
        "number": phone,
        "options": {"delay": 1200, "presence": "composing"},
        "textMessage": {"text": text}
    }
    async with httpx.AsyncClient() as client:
        try:
            await client.post(f"{EVOLUTION_API_URL}/message/sendText/{instance_name}", json=payload, headers=headers)
        except Exception as e:
            logger.error(f"Erro ao enviar msg via Evolution: {e}")

async def handle_ai_message(user_id: str, phone: str, message: str, config: dict):
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        logger.error("OPENAI_API_KEY não configurada")
        return
        
    ai_client = AsyncOpenAI(api_key=openai_key)
    
    convo = await db.whatsapp_conversations.find_one({"user_id": user_id, "phone": phone})
    if not convo:
        convo = {"user_id": user_id, "phone": phone, "history": []}
        
    history = convo["history"]
    history.append({"role": "user", "content": message})
    
    if len(history) > 10:
        history = history[-10:]
        
    services = await db.services.find({"user_id": user_id, "active": True}, {"_id": 0}).to_list(100)
    services_text = "\n".join([f"- ID: {s['service_id']}, Nome: {s['name']}, Duração: {s['duration_minutes']} min, Preço: R${s['price']}" for s in services])
    
    system_prompt = f"""{config['ai_prompt']}
    
    SERVIÇOS DISPONÍVEIS:
    {services_text}
    
    INSTRUÇÕES CRITICAS:
    Você DEVE consultar horários e DEVE fazer agendamentos enviando comandos exatos, sem adicionar nenhum outro texto na mesma mensagem de comando.
    Para ver horários de um dia (formato YYYY-MM-DD), responda EXATAMENTE: [TOOL:check_availability:YYYY-MM-DD:SERVICE_ID]
    Para realizar um agendamento, responda EXATAMENTE: [TOOL:book_appointment:SERVICE_ID:YYYY-MM-DD:HH:MM:NomeDoCliente]
    Exemplo de agendamento: [TOOL:book_appointment:svc_123:2026-04-10:14:30:Maria Silva]

    Se a resposta não for um comando, fale com o cliente normalmente usando seu tom configurado.
    Identidade do cliente: o telefone é o identificador único. Peça o nome dele se não souber.
    """
    
    messages = [{"role": "system", "content": system_prompt}] + history
    
    response_text = ""
    for step in range(3):
        res = await ai_client.chat.completions.create(
            model='gpt-4o-mini',
            messages=messages
        )
        reply = res.choices[0].message.content
        
        if "[TOOL:check_availability:" in reply:
            try:
                parts = reply.split("[TOOL:check_availability:")[1].split("]")[0].split(":")
                date_str = parts[0]
                service_id = parts[1]
                slots = await calculate_slots(user_id, date_str, service_id)
                slots_txt = ", ".join([s["start_time"] for s in slots]) if slots else "Nenhum horário livre."
                history.append({"role": "assistant", "content": reply})
                history.append({"role": "user", "content": f"SISTEMA: Retorno de check_availability ({date_str}): {slots_txt}. Agora formate essa resposta amigavelmente para o cliente e devolva."})
                messages = [{"role": "system", "content": system_prompt}] + history
                continue
            except Exception as e:
                history.append({"role": "assistant", "content": reply})
                history.append({"role": "user", "content": f"SISTEMA: Erro na chamada da ferramenta: {e}"})
                messages = [{"role": "system", "content": system_prompt}] + history
                continue
            
        if "[TOOL:book_appointment:" in reply:
            try:
                parts = reply.split("[TOOL:book_appointment:")[1].split("]")[0].split(":")
                service_id = parts[0]
                date_str = parts[1]
                time_str = f"{parts[2]}:{parts[3]}"
                client_name = parts[4]
                
                # Encontrar o serviço
                service = await db.services.find_one({"service_id": service_id, "user_id": user_id})
                if not service:
                    raise Exception("Servico invalido")
                    
                end_minutes = time_to_minutes(time_str) + service["duration_minutes"]
                
                # Criar appointment (simples)
                apt_id = f"apt_{uuid.uuid4().hex[:8]}"
                token = secrets.token_urlsafe(16)
                apt = {
                    "appointment_id": apt_id,
                    "user_id": user_id,
                    "service_id": service_id,
                    "service_name": service["name"],
                    "client_name": client_name,
                    "client_phone": phone,
                    "date": date_str,
                    "start_time": time_str,
                    "end_time": minutes_to_time(end_minutes),
                    "status": "confirmed",
                    "source": "whatsapp_ai",
                    "token": token,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Gravar cliente se não existir
                existing_client = await db.clients.find_one({"user_id": user_id, "phone": phone})
                if not existing_client:
                    await db.clients.insert_one({
                        "client_id": f"cli_{uuid.uuid4().hex[:8]}",
                        "user_id": user_id,
                        "name": client_name,
                        "phone": phone,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                
                await db.appointments.insert_one(apt)
                history.append({"role": "assistant", "content": reply})
                history.append({"role": "user", "content": f"SISTEMA: Agendamento CONFIRMADO! ID: {apt_id}. Agradeça e lembre o cliente do horário."})
                messages = [{"role": "system", "content": system_prompt}] + history
                continue
            except Exception as e:
                history.append({"role": "assistant", "content": reply})
                history.append({"role": "user", "content": f"SISTEMA: Erro ao agendar: {e}. Diga ao cliente que houve um problema e tente novamente com novos horários."})
                messages = [{"role": "system", "content": system_prompt}] + history
                continue
                
        # Final response
        response_text = reply
        break
        
    await db.whatsapp_conversations.update_one(
        {"user_id": user_id, "phone": phone},
        {"$set": {"history": history}},
        upsert=True
    )
    
    if response_text:
        await send_whatsapp_message(config["instance_name"], phone, response_text)

@app.post("/api/whatsapp/webhook/{user_id}")
async def whatsapp_webhook(user_id: str, request: Request):
    payload = await request.json()
    config = await db.whatsapp_config.find_one({"user_id": user_id})
    if not config or not config.get("is_active"):
        return {"status": "ignored"}
        
    if payload.get("event") == "messages.upsert":
        for msg in payload.get("data", {}).get("messages", []):
            if msg.get("key", {}).get("fromMe"):
                continue
            phone = msg.get("key", {}).get("remoteJid", "").split("@")[0]
            text = ""
            msg_content = msg.get("message", {})
            if "conversation" in msg_content:
                text = msg_content["conversation"]
            elif "extendedTextMessage" in msg_content:
                text = msg_content["extendedTextMessage"].get("text", "")
            if text:
                asyncio.create_task(handle_ai_message(user_id, phone, text, config))
    return {"status": "ok"}


# ==================== REVIEWS ====================

class ReviewSubmit(BaseModel):
    rating: int
    comment: Optional[str] = ""

@api_router.post("/cron/send-review-invites")
async def cron_send_review_invites(req: Request):
    BR_TZ = pytz.timezone("America/Sao_Paulo")
    agora = datetime.now(BR_TZ)
    ontem = agora - timedelta(days=1)
    
    ontem_str = ontem.strftime("%Y-%m-%d")
    hoje_str = agora.strftime("%Y-%m-%d")

    apts = await db.appointments.find({
        "status": {"$in": ["completed"]},
        "date": {"$in": [ontem_str, hoje_str]},
        "review_invited": {"$ne": True},
        "client_email": {"$ne": ""}
    }).to_list(100)
    
    if not EMAIL_ENABLED or len(apts) == 0:
        return {"msg": "Sem convites aptos ou email desativado.", "count": len(apts)}
        
    invited = 0
    for apt in apts:
        apt_id = str(apt["_id"])
        
        prof = await db.users.find_one({"user_id": apt["user_id"]})
        if not prof: continue
        
        prof_name = prof.get("name", "Profissional")
        link = f"{FRONTEND_URL}/avaliar/{apt_id}"
        
        html_body = f"""
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px;">
            <h2>Olá, {apt.get('client_name', 'Cliente')}!</h2>
            <p>Como foi o seu atendimento com <strong>{prof_name}</strong>?</p>
            <p>Ajude-nos a melhorar avaliando a sua experiência.</p>
            <br/>
            <a href="{link}" style="background: #00D49D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Avaliar Atendimento
            </a>
            <br/><br/>
            <p>Obrigado!</p>
        </div>
        """
        
        try:
            resend.Emails.send({
                "from": EMAIL_FROM,
                "to": apt["client_email"],
                "subject": f"Como foi o seu atendimento com {prof_name}?",
                "html": html_body
            })
            await db.appointments.update_one(
                {"_id": apt["_id"]},
                {"$set": {"review_invited": True}}
            )
            invited += 1
        except Exception as e:
            logger.error(f"Erro ao enviar review p/ {apt.get('client_email', '')}: {e}")
            
    return {"msg": "Convites processados", "invited_count": invited}

@api_router.get("/reviews/appointment/{appointment_id}")
async def get_appointment_for_review(appointment_id: str):
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(appointment_id)
    except:
        raise HTTPException(400, "ID inválido")
        
    apt = await db.appointments.find_one({"_id": obj_id})
    if not apt:
        raise HTTPException(404, "Agendamento não encontrado")
        
    prof = await db.users.find_one({"user_id": apt["user_id"]})
    prof_name = prof.get("name", "Profissional") if prof else "Profissional"
    
    # get service name
    svc = await db.services.find_one({"service_id": apt.get("service_id", ""), "user_id": apt["user_id"]})
    svc_name = svc.get("name", apt.get("service_name", "Serviço")) if svc else "Serviço"
    
    return {
        "client_name": apt.get("client_name", "Cliente"),
        "service_name": svc_name,
        "professional_name": prof_name,
        "professional_picture": prof.get("picture", "") if prof else "",
        "date": apt["date"],
        "status": apt["status"]
    }

@api_router.post("/reviews/{appointment_id}")
async def submit_review(appointment_id: str, data: ReviewSubmit):
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(appointment_id)
    except:
        raise HTTPException(400, "ID inválido")
        
    apt = await db.appointments.find_one({"_id": obj_id})
    if not apt:
        raise HTTPException(404, "Agendamento não encontrado")
        
    existing = await db.reviews.find_one({"appointment_id": appointment_id})
    if existing:
        raise HTTPException(400, "Agendamento já avaliado")
        
    review_doc = {
        "appointment_id": appointment_id,
        "user_id": apt["user_id"],
        "client_name": apt.get("client_name", "Cliente"),
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_doc)
    return {"msg": "Avaliação salva com sucesso"}


# ==================== N8N INTEGRATION ====================

class N8NConfigUpdate(BaseModel):
    n8n_url: Optional[str] = ""
    n8n_api_key: Optional[str] = ""
    whatsapp_number: Optional[str] = ""
    is_active: bool = False
    ai_prompt: Optional[str] = ""

@api_router.get("/whatsapp/config")
async def get_whatsapp_config(user: dict = Depends(get_current_user)):
    conf = await db.whatsapp_config.find_one({"user_id": user["user_id"]})
    if not conf:
        return {"n8n_url": "", "n8n_api_key": "", "whatsapp_number": "", "is_active": False, "ai_prompt": "", "webhook_url": f"https://clickagenda-production.up.railway.app/api/n8n/{user['user_id']}/book"}
    conf["_id"] = str(conf["_id"])
    conf["webhook_url"] = f"https://clickagenda-production.up.railway.app/api/n8n/{user['user_id']}/book"
    return conf

@api_router.post("/whatsapp/config")
async def save_whatsapp_config(data: N8NConfigUpdate, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    conf = await db.whatsapp_config.find_one({"user_id": user_id})
    
    api_key = data.n8n_api_key
    if not api_key and (not conf or not conf.get("n8n_api_key")):
        import secrets
        api_key = secrets.token_urlsafe(32)
    elif not api_key and conf:
        api_key = conf.get("n8n_api_key")

    update_doc = {
        "n8n_url": data.n8n_url,
        "n8n_api_key": api_key,
        "whatsapp_number": data.whatsapp_number,
        "is_active": data.is_active,
        "ai_prompt": data.ai_prompt,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if conf:
        await db.whatsapp_config.update_one({"user_id": user_id}, {"$set": update_doc})
    else:
        update_doc["user_id"] = user_id
        update_doc["created_at"] = update_doc["updated_at"]
        await db.whatsapp_config.insert_one(update_doc)

    return {"msg": "ConfigURAÇÕES salvas", "n8n_api_key": api_key}

async def verify_n8n_key(req: Request, user_id: str):
    key = req.headers.get("X-N8N-Key")
    if not key:
        raise HTTPException(401, "Missing X-N8N-Key header")
    conf = await db.whatsapp_config.find_one({"user_id": user_id})
    if not conf or conf.get("n8n_api_key") != key:
        raise HTTPException(403, "Invalid N8N Key")
    if not conf.get("is_active", False):
        raise HTTPException(403, "Agent is disabled")
    return conf

@api_router.get("/n8n/{user_id}/services")
async def n8n_get_services(user_id: str, req: Request):
    await verify_n8n_key(req, user_id)
    svcs = await db.services.find({"user_id": user_id, "active": True}).to_list(100)
    for s in svcs:
        s["_id"] = str(s["_id"])
    return svcs

@api_router.get("/n8n/{user_id}/slots")
async def n8n_get_slots(user_id: str, req: Request, date: str, service_id: str):
    await verify_n8n_key(req, user_id)
    slots = await calculate_slots(user_id, service_id, date)
    return {"slots": slots}

@api_router.post("/n8n/{user_id}/book")
async def n8n_book_appointment(user_id: str, req: Request, data: AppointmentCreate):
    await verify_n8n_key(req, user_id)
    
    svc = await db.services.find_one({"service_id": data.service_id, "user_id": user_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")

    duration = svc["duration_minutes"]
    start_mins = time_to_minutes(data.start_time)
    end_mins = start_mins + duration
    end_time = minutes_to_time(end_mins)

    # Check for conflicts
    existing = await db.appointments.find(
        {"user_id": user_id, "date": data.date, "status": {"$nin": ["cancelled", "no_show"]}},
        {"_id": 0}
    ).to_list(1000)

    for apt in existing:
        apt_s = time_to_minutes(apt["start_time"])
        apt_e = time_to_minutes(apt["end_time"])
        if start_mins < apt_e and end_mins > apt_s:
            raise HTTPException(409, "Horário indisponível para este serviço")

    token = secrets.token_urlsafe(32)
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "service_id": data.service_id,
        "service_name": svc["name"],
        "service_price": svc.get("price", 0),
        "client_name": data.client_name,
        "client_phone": normalize_phone(data.client_phone),
        "client_email": data.client_email,
        "date": data.date,
        "start_time": data.start_time,
        "end_time": end_time,
        "status": "scheduled",
        "notes": data.notes or "Agendado via IA Chatbot",
        "token": token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.appointments.insert_one(appointment)
    
    # Notify (optional but good)
    user = await db.users.find_one({"user_id": user_id})
    await mock_send_whatsapp(user_id, appointment)
    
    return {"status": "success", "appointment_id": appointment["appointment_id"]}

@api_router.get("/n8n/{user_id}/config")
async def n8n_get_config(user_id: str, req: Request):
    conf = await verify_n8n_key(req, user_id)
    prof = await db.users.find_one({"user_id": user_id})
    svcs = await db.services.find({"user_id": user_id, "active": True}).to_list(100)
    return {
        "professional_name": prof.get("name", ""),
        "business_name": prof.get("business_name", ""),
        "ai_prompt": conf.get("ai_prompt", ""),
        "services": [{"id": s["service_id"], "name": s["name"], "price": s["price"], "duration": s["duration_minutes"]} for s in svcs]
    }


# ==================== ROOT ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    
    import pytz
    BR_TZ = pytz.timezone("America/Sao_Paulo")
    now_br = datetime.now(BR_TZ)
    today_str = now_br.strftime("%Y-%m-%d")
    
    # 1. Appointments Today
    today_apts = await db.appointments.count_documents({
        "user_id": user_id,
        "date": today_str,
        "status": {"$in": ["confirmed", "completed", "pending"]}
    })
    
    # 2. Confirmation Rate (últimos 30 dias)
    thirty_days_ago = (now_br - timedelta(days=30)).strftime("%Y-%m-%d")
    total_30d = await db.appointments.count_documents({
        "user_id": user_id,
        "date": {"$gte": thirty_days_ago}
    })
    confirmed_30d = await db.appointments.count_documents({
        "user_id": user_id,
        "date": {"$gte": thirty_days_ago},
        "status": {"$in": ["confirmed", "completed"]}
    })
    conf_rate = (confirmed_30d / total_30d * 100) if total_30d > 0 else 0.0
    
    # 3. Monthly Revenue (mês atual)
    start_of_month = now_br.replace(day=1).strftime("%Y-%m-%d")
    current_month_apts = await db.appointments.find({
        "user_id": user_id,
        "date": {"$gte": start_of_month},
        "status": {"$in": ["confirmed", "completed"]}
    }).to_list(1000)
    
    monthly_revenue = 0.0
    for apt in current_month_apts:
        svc = await db.services.find_one({"service_id": apt.get("service_id", ""), "user_id": user_id})
        if svc:
            monthly_revenue += float(svc.get("price", 0))
            
    # 4. Recent Appointments
    recent_apts = await db.appointments.find({"user_id": user_id}).sort([("created_at", -1)]).limit(10).to_list(10)
    for apt in recent_apts:
        apt["_id"] = str(apt["_id"])
        svc = await db.services.find_one({"service_id": apt.get("service_id", ""), "user_id": user_id})
        apt["service_name"] = svc.get("name", "Serviço") if svc else "Serviço Deletado"
        
    # 5. Upcoming Clients
    upcoming = await db.appointments.find({
        "user_id": user_id,
        "date": {"$gte": today_str},
        "status": {"$in": ["confirmed", "pending"]}
    }).sort([("date", 1), ("start_time", 1)]).limit(5).to_list(5)
    for apt in upcoming:
        apt["_id"] = str(apt["_id"])
        svc = await db.services.find_one({"service_id": apt.get("service_id", ""), "user_id": user_id})
        apt["service_name"] = svc.get("name", "Serviço") if svc else "Serviço Deletado"
        
    return {
        "appointments_today": today_apts,
        "confirmation_rate": round(conf_rate, 1),
        "monthly_revenue": round(monthly_revenue, 2),
        "recent_appointments": recent_apts,
        "upcoming_clients": upcoming
    }


@api_router.get("/")
async def root():
    return {"message": "SalãoZap API", "version": "1.0.0"}

app.include_router(api_router)

APP_ENV = os.environ.get("APP_ENV", "development")
cors_origins_raw = os.environ.get("CORS_ORIGINS", "")

if APP_ENV == "production":
    if not cors_origins_raw:
        raise RuntimeError(
            "FATAL: CORS_ORIGINS não definido em produção. "
            "Configure a variável de ambiente antes de iniciar o servidor."
        )
    cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
else:
    # Desenvolvimento: wildcard permitido com aviso
    if not cors_origins_raw:
        logger.warning("CORS_ORIGINS não definido. Usando * — apenas para desenvolvimento.")
        cors_origins = ["*"]
    else:
        cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Validações de segurança em produção
    if APP_ENV == "production" and not os.environ.get("CORS_ORIGINS"):
        raise RuntimeError("FATAL: CORS_ORIGINS obrigatório em produção.")
    if APP_ENV == "production" and os.environ.get("JWT_SECRET") == "troque-por-um-valor-aleatorio-seguro":
        raise RuntimeError("FATAL: JWT_SECRET não foi alterado. Use um valor seguro em produção.")

    await db.users.create_index("user_id", unique=True, background=True)
    await db.users.create_index("email", unique=True, background=True, sparse=True)
    await db.users.create_index("slug", unique=True, background=True, sparse=True)
    await db.appointments.create_index([("user_id", 1), ("date", 1)], background=True)
    await db.appointments.create_index("token", unique=True, background=True, sparse=True)
    await db.services.create_index([("user_id", 1)], background=True)
    await db.clients.create_index([("user_id", 1)], background=True)
    await db.availability_rules.create_index([("user_id", 1)], background=True)
    # TTL index: remove sessões expiradas automaticamente (Fix 6)
    await db.user_sessions.create_index("session_token", background=True)
    await db.user_sessions.create_index(
        "expires_at",
        expireAfterSeconds=0,
        background=True
    )
    await db.quick_links.create_index("code", unique=True, background=True, sparse=True)
    await db.quick_links.create_index([("user_id", 1)], background=True)
    await db.turbo_offers.create_index([("user_id", 1)], background=True)
    await db.turbo_offers.create_index([("slug", 1), ("status", 1)], background=True)
    await db.favorites.create_index([("client_user_id", 1)], background=True)
    await db.users.create_index([("role", 1), ("city", 1)], background=True)
    await db.auth_events.create_index([("user_id", 1), ("created_at", -1)], background=True)
    await db.reviews.create_index([("user_id", 1), ("created_at", -1)], background=True)
    await db.reviews.create_index("appointment_id", unique=True, background=True, sparse=True)
    # TTL index para tokens de reset de senha (Fix 2)
    await db.password_reset_tokens.create_index("token", unique=True, background=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0, background=True)
    logger.info("SalãoZap API started successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
