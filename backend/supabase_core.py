"""Camada Supabase que preserva os contratos HTTP consumidos pelo frontend legado."""
import os
import secrets
import httpx
import logging
import hashlib
import hmac
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field, field_validator, model_validator
from supabase import create_client as create_supabase_client
from integration_vault import delete_credentials, load_credentials, masked, provider_values, save_credentials

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
# Este cliente fica exclusivamente com a service_role. Nunca autentique um
# usuário nele: sign_in altera o token ativo do cliente e derruba permissões
# administrativas de Storage/PostgREST no processo inteiro.
supabase = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def auth_client():
    """Cliente descartável para login/sessão, separado da service_role."""
    return create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
router = APIRouter(prefix="/api")
PROFILE_MEDIA_BUCKET = "profile-media"
logger = logging.getLogger("clickagenda.storage")


def supabase_is_unavailable(error: Exception) -> bool:
    """Diferencia falta de conexão do erro normal de credenciais ou validação."""
    return isinstance(error, httpx.HTTPError) or "getaddrinfo failed" in str(error).lower()


def supabase_unavailable_error(error: Exception) -> HTTPException:
    return HTTPException(503, "Não foi possível conectar ao Supabase. Verifique a URL do projeto e a conexão com a internet.")


def normalize_phone(value: str) -> str:
    return "".join(filter(str.isdigit, value or ""))


class Register(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=10, max_length=128)
    business_name: str = ""
    slug: str = ""
    custom_link: str = ""
    phone: str = ""
    role: str = "professional"

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str):
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("A senha deve ter ao menos 10 caracteres, com letras e números")
        return value


class Login(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)


def validate_strong_password(value: str) -> str:
    if len(value) < 10 or not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("A senha deve ter ao menos 10 caracteres, com letras e números")
    return value


class ForgotPassword(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class ResetPassword(BaseModel):
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str):
        return validate_strong_password(value)


class CheckoutRequest(BaseModel):
    provider: str = Field(pattern="^(stripe|woovi|stone)$")


class PlanChange(BaseModel):
    plan: str = Field(pattern="^(freemium|pro)$")
    status: str = Field(default="active", pattern="^(pending|active|past_due|cancelled|expired)$")


class PixelSettings(BaseModel):
    pixel_id: str = Field(default="", max_length=32)

    @field_validator("pixel_id")
    @classmethod
    def valid_pixel_id(cls, value: str):
        if value and not value.isdigit():
            raise ValueError("O ID do Pixel deve conter apenas números")
        return value


class IntegrationCredentials(BaseModel):
    provider: str = Field(pattern="^(stripe|woovi|stone)$")
    values: dict[str, str]

    @model_validator(mode="after")
    def valid_values(self):
        allowed = {
            "stripe": {"secret_key", "price_id", "webhook_secret"},
            "woovi": {"app_id", "webhook_authorization", "webhook_hmac_secret"},
            "stone": {"bearer_token", "merchant_id"},
        }
        if not self.values or any(key not in allowed[self.provider] or not isinstance(secret, str) or not secret.strip() for key, secret in self.values.items()):
            raise ValueError("Credenciais inválidas")
        self.values = {key: secret.strip() for key, secret in self.values.items()}
        return self


class Service(BaseModel):
    name: str
    description: str = ""
    duration_minutes: int = 60
    price: float = 0
    buffer_minutes: int = 15
    category: str = ""
    active: bool = True


class Client(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    notes: str = ""
    tags: list[str] = []


class Availability(BaseModel):
    rules: list[dict] = []
    breaks: list[dict] = []


class Appointment(BaseModel):
    service_id: str
    client_name: str
    client_phone: str
    client_email: str = ""
    date: str
    start_time: str
    notes: str = ""


class Profile(BaseModel):
    name: str | None = None
    business_name: str | None = None
    slug: str | None = None
    phone: str | None = None
    bio: str | None = None
    address: str | None = None
    business_type: str | None = None
    picture: str | None = None
    cover_picture: str | None = None
    social_links: dict | None = None
    featured_service_ids: list[str] | None = None
    min_advance_hours: int | None = None
    cancellation_policy_hours: int | None = None
    city: str | None = None
    state: str | None = None
    onboarding_completed: bool | None = None


def legacy_profile(row):
    return {"user_id": row["id"], "email": row.get("email", ""), "name": row["full_name"], "role": row["role"], "slug": row["slug"], "business_name": row.get("business_name") or "", "phone": row.get("phone") or "", "bio": row.get("bio") or "", "business_type": row.get("business_type") or "", "address": row.get("address") or "", "city": row.get("city") or "", "state": row.get("state") or "", "picture": row.get("picture") or "", "cover_picture": row.get("cover_picture") or "", "social_links": row.get("social_links") or {}, "featured_service_ids": row.get("featured_service_ids") or [], "min_advance_hours": row.get("min_advance_hours", 0), "cancellation_policy_hours": row.get("cancellation_policy_hours", 6), "onboarding_completed": row.get("onboarding_completed", False), "plan": row.get("plan") or "freemium"}


def apply_effective_role(profile: dict, email: str | None):
    """Concede administração pelo allowlist do ambiente em toda resposta de autenticação."""
    profile["email"] = email or profile.get("email", "")
    admin_emails = {item.strip().lower() for item in os.getenv("SUPERADMIN_EMAILS", "").split(",") if item.strip()}
    if profile["email"].lower() in admin_emails:
        profile["role"] = "superadmin"
    return profile


def current_user(request: Request):
    token = request.cookies.get("session_token") or request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        auth_user = supabase.auth.get_user(token).user
        profile = supabase.table("profiles").select("*").eq("id", str(auth_user.id)).single().execute().data
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(401, "Invalid session") from exc
    return apply_effective_role(profile, auth_user.email)


def set_session_cookie(response: Response, token: str, expires_in: int | None):
    """Cookie de sessão inacessível ao JavaScript e obrigatório em HTTPS na produção."""
    response.set_cookie(
        "session_token",
        token,
        httponly=True,
        secure=os.getenv("APP_ENV", "development") == "production",
        samesite="lax",
        max_age=expires_in or 3600,
        path="/",
    )


def require_superadmin(user=Depends(current_user)):
    if user.get("role") != "superadmin":
        raise HTTPException(403, "Acesso restrito ao superadmin")
    return user


def monthly_booking_count(professional_id: str) -> int:
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).date().isoformat()
    rows = supabase.table("appointments").select("id").eq("professional_id", professional_id).gte("appointment_date", month_start).not_.in_("status", ["cancelled", "no_show"]).execute().data
    return len(rows)


def enforce_plan_limit(profile: dict):
    if profile.get("role") == "superadmin" or profile.get("plan") == "pro":
        return
    if monthly_booking_count(profile["id"]) >= 30:
        raise HTTPException(402, "O plano Freemium permite até 30 agendamentos por mês. Assine o Pro para continuar.")


def integration_value(provider: str, key: str, env_name: str) -> str:
    """Prioriza o cofre do painel e mantém compatibilidade com variáveis do servidor."""
    try:
        return provider_values(supabase, provider).get(key) or os.getenv(env_name, "")
    except HTTPException:
        return os.getenv(env_name, "")


def service_out(row):
    return {**row, "service_id": row["legacy_service_id"], "price": row.get("price_cents", 0) / 100}


@router.get("/")
def healthcheck():
    """Resposta estável para verificar se o núcleo Supabase está ativo."""
    return {"message": "ClickAgenda API", "database": "supabase"}


@router.post("/profile/upload")
async def upload_profile_image(
    image_type: str = Query(..., pattern="^(picture|cover_picture)$"),
    file: UploadFile = File(...),
    profile: dict = Depends(current_user),
):
    """Envia mídia de perfil pelo servidor, mantendo a chave de serviço fora do navegador."""
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Envie uma imagem JPG, PNG, WEBP ou GIF")
    content = await file.read()
    if not content or len(content) > 4 * 1024 * 1024:
        raise HTTPException(400, "A imagem deve ter no máximo 4 MB")

    try:
        supabase.storage.get_bucket(PROFILE_MEDIA_BUCKET)
    except Exception as exc:
        logger.exception("Bucket de mídia ausente ou inacessível")
        raise HTTPException(
            503,
            "O armazenamento de imagens ainda não está configurado. Peça ao administrador para criar o bucket profile-media no Supabase.",
        ) from exc

    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}[file.content_type]
    path = f"{profile['id']}/{image_type}-{secrets.token_hex(12)}.{extension}"
    try:
        supabase.storage.from_(PROFILE_MEDIA_BUCKET).upload(
            path,
            content,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "false"},
        )
        return {"url": supabase.storage.from_(PROFILE_MEDIA_BUCKET).get_public_url(path)}
    except Exception as exc:
        logger.exception("Falha ao enviar imagem para o Supabase Storage")
        raise HTTPException(502, "O Supabase recusou o envio da imagem. Verifique o bucket profile-media e as permissões de Storage.") from exc


def client_out(row):
    return {**row, "client_id": row["legacy_client_id"], "user_id": row["professional_id"], "last_visit": row.get("last_visit")}


def appointment_out(row):
    return {**row, "appointment_id": row["legacy_appointment_id"], "user_id": row["professional_id"], "service_id": row.get("legacy_service_id"), "date": str(row["appointment_date"]), "start_time": str(row["start_time"])[:5], "end_time": str(row["end_time"])[:5], "token": row.get("token") or row.get("manage_token")}


@router.post("/auth/register")
def register(data: Register, response: Response):
    slug = (data.slug or data.custom_link or "-".join(data.name.lower().split())).strip().lower()
    if not slug:
        raise HTTPException(400, "Escolha um link para sua agenda")
    try:
        slug_in_use = supabase.table("profiles").select("id").eq("slug", slug).execute().data
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(500, "Não foi possível validar o link da agenda") from exc
    if slug_in_use:
        raise HTTPException(400, "Este link já está em uso")
    try:
        result = supabase.auth.admin.create_user({"email": data.email, "password": data.password, "email_confirm": True, "user_metadata": {"full_name": data.name, "business_name": data.business_name, "slug": slug}})
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(400, "Não foi possível criar a conta com esses dados") from exc
    user_id = str(result.user.id)
    profile_values = {"role": data.role if data.role in ("professional", "client") else "professional"}
    if data.phone:
        profile_values["phone"] = data.phone
    supabase.table("profiles").update(profile_values).eq("id", user_id).execute()
    # O frontend legado continua o onboarding autenticado logo após o cadastro.
    # Criar o usuário pelo admin não produz uma sessão de navegador, então
    # autenticamos explicitamente e mantemos o mesmo contrato do login.
    try:
        session_result = auth_client().auth.sign_in_with_password({"email": data.email, "password": data.password})
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(500, "Conta criada, mas não foi possível iniciar a sessão") from exc
    if not session_result.session:
        raise HTTPException(500, "Conta criada, mas não foi possível iniciar a sessão")
    set_session_cookie(response, session_result.session.access_token, session_result.session.expires_in)
    profile = supabase.table("profiles").select("*").eq("id", user_id).single().execute().data
    return {"user": legacy_profile(apply_effective_role(profile, data.email)), "session_token": session_result.session.access_token}


@router.post("/auth/login")
def login(data: Login, response: Response):
    try:
        result = auth_client().auth.sign_in_with_password({"email": data.email, "password": data.password})
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(401, "Email ou senha incorretos") from exc
    if not result.session:
        raise HTTPException(401, "Email ou senha incorretos")
    set_session_cookie(response, result.session.access_token, result.session.expires_in)
    profile = supabase.table("profiles").select("*").eq("id", str(result.user.id)).single().execute().data
    return {"user": legacy_profile(apply_effective_role(profile, result.user.email)), "session_token": result.session.access_token}


@router.get("/auth/me")
def me(user=Depends(current_user)): return legacy_profile(user)


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("session_token", path="/")
    return {"message": "Logout realizado"}


@router.post("/auth/forgot-password")
def forgot_password(data: ForgotPassword):
    """Solicita recuperação sem revelar se o e-mail existe na plataforma."""
    redirect_to = os.getenv("PASSWORD_RESET_REDIRECT_URL") or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/redefinir-senha"
    try:
        auth_client().auth.reset_password_email(data.email, options={"redirect_to": redirect_to})
    except Exception as exc:
        # Resposta neutra evita enumeração de contas; o erro fica apenas no log.
        logger.warning("Falha ao solicitar recuperação de senha: %s", type(exc).__name__)
    return {"message": "Se o e-mail estiver cadastrado, enviaremos um link de recuperação."}


@router.post("/auth/reset-password")
def reset_password(data: ResetPassword, response: Response, user=Depends(current_user)):
    """Troca senha usando o access token de recuperação emitido pelo Supabase."""
    try:
        supabase.auth.admin.update_user_by_id(user["id"], {"password": data.new_password})
    except Exception as exc:
        if supabase_is_unavailable(exc):
            raise supabase_unavailable_error(exc) from exc
        raise HTTPException(400, "O link de recuperação é inválido ou expirou") from exc
    response.delete_cookie("session_token", path="/")
    return {"message": "Senha redefinida com sucesso"}


@router.put("/profile")
def update_profile(data: Profile, user=Depends(current_user)):
    values = data.model_dump(exclude_none=True)
    column_map = {"name": "full_name"}
    values = {column_map.get(key, key): value for key, value in values.items()}
    if "slug" in values:
        values["slug"] = values["slug"].strip().lower()
        taken = supabase.table("profiles").select("id").eq("slug", values["slug"]).neq("id", user["id"]).execute().data
        if taken: raise HTTPException(400, "Este link ja esta em uso")
    if "featured_service_ids" in values:
        values["featured_service_ids"] = values["featured_service_ids"][:3]
    rows = supabase.table("profiles").update(values).eq("id", user["id"]).execute().data
    rows[0]["email"] = user.get("email", "")
    return legacy_profile(rows[0])


@router.get("/dashboard/stats")
def dashboard_stats(user=Depends(current_user)):
    zone = ZoneInfo(user.get("timezone") or "America/Sao_Paulo")
    today = datetime.now(zone).date().isoformat()
    rows = supabase.table("appointments").select("*").eq("professional_id", user["id"]).execute().data
    active = [row for row in rows if row["status"] not in ("cancelled", "no_show")]
    today_rows = [row for row in active if str(row.get("appointment_date")) == today]
    completed = [row for row in active if row["status"] == "completed"]
    month = today[:7]
    revenue = sum(row.get("service_price", 0) / 100 for row in completed if str(row.get("appointment_date", "")).startswith(month))
    return {"appointments_today": len(today_rows), "total_appointments": len(active), "monthly_revenue": round(revenue, 2), "pending_confirmations": len([row for row in active if row["status"] == "scheduled"]), "recent_appointments": [appointment_out({**row, "legacy_service_id": None}) for row in sorted(active, key=lambda row: str(row.get("start_at")), reverse=True)[:5]]}


@router.get("/services")
def services(user=Depends(current_user)):
    rows = supabase.table("services").select("*").eq("professional_id", user["id"]).order("created_at").execute().data
    return [service_out(r) for r in rows]


@router.post("/services")
def create_service(data: Service, user=Depends(current_user)):
    legacy_id = "svc_" + secrets.token_hex(4)
    row = supabase.table("services").insert({"professional_id": user["id"], "legacy_service_id": legacy_id, "name": data.name, "description": data.description, "duration_minutes": data.duration_minutes, "buffer_minutes": data.buffer_minutes, "price_cents": round(data.price * 100), "category": data.category, "active": data.active}).execute().data[0]
    return service_out(row)


@router.put("/services/{service_id}")
def update_service(service_id: str, data: Service, user=Depends(current_user)):
    row = supabase.table("services").update({"name": data.name, "description": data.description, "duration_minutes": data.duration_minutes, "buffer_minutes": data.buffer_minutes, "price_cents": round(data.price * 100), "category": data.category, "active": data.active}).eq("professional_id", user["id"]).eq("legacy_service_id", service_id).execute().data
    if not row: raise HTTPException(404, "Servico nao encontrado")
    return service_out(row[0])


@router.delete("/services/{service_id}")
def delete_service(service_id: str, user=Depends(current_user)):
    supabase.table("services").delete().eq("professional_id", user["id"]).eq("legacy_service_id", service_id).execute()
    return {"message": "Servico removido"}


@router.get("/clients")
def clients(search: str | None = None, user=Depends(current_user)):
    query = supabase.table("clients").select("*").eq("professional_id", user["id"]).order("name")
    rows = query.execute().data
    if search:
        needle = search.lower()
        rows = [r for r in rows if needle in (r.get("name") or "").lower() or needle in (r.get("phone") or "").lower() or needle in (r.get("email") or "").lower()]
    return [client_out(r) for r in rows]


@router.post("/clients")
def create_client(data: Client, user=Depends(current_user)):
    legacy_id = "cli_" + secrets.token_hex(4)
    row = supabase.table("clients").insert({"professional_id": user["id"], "legacy_client_id": legacy_id, "name": data.name, "phone": data.phone, "phone_norm": normalize_phone(data.phone), "email": data.email, "notes": data.notes, "tags": data.tags}).execute().data[0]
    return client_out(row)


@router.put("/clients/{client_id}")
def update_client(client_id: str, data: Client, user=Depends(current_user)):
    rows = supabase.table("clients").update({"name": data.name, "phone": data.phone, "phone_norm": normalize_phone(data.phone), "email": data.email, "notes": data.notes, "tags": data.tags}).eq("professional_id", user["id"]).eq("legacy_client_id", client_id).execute().data
    if not rows: raise HTTPException(404, "Cliente nao encontrado")
    return client_out(rows[0])


@router.delete("/clients/{client_id}")
def delete_client(client_id: str, user=Depends(current_user)):
    supabase.table("clients").delete().eq("professional_id", user["id"]).eq("legacy_client_id", client_id).execute()
    return {"message": "Cliente removido"}


@router.get("/availability")
def availability(user=Depends(current_user)):
    rules = supabase.table("availability_rules").select("*").eq("professional_id", user["id"]).order("weekday").execute().data
    breaks = supabase.table("availability_breaks").select("*").eq("professional_id", user["id"]).execute().data
    return {"rules": [{"rule_id": r["id"], "user_id": r["professional_id"], "day_of_week": r["weekday"], "start_time": str(r["start_time"])[:5], "end_time": str(r["end_time"])[:5], "is_active": r["active"]} for r in rules], "breaks": [{"break_id": b["id"], "user_id": b["professional_id"], "day_of_week": b["weekday"], "start_time": str(b["start_time"])[:5], "end_time": str(b["end_time"])[:5]} for b in breaks]}


@router.post("/availability")
def set_availability(data: Availability, user=Depends(current_user)):
    supabase.table("availability_rules").delete().eq("professional_id", user["id"]).execute()
    supabase.table("availability_breaks").delete().eq("professional_id", user["id"]).execute()
    if data.rules: supabase.table("availability_rules").insert([{"professional_id": user["id"], "weekday": r["day_of_week"], "start_time": r["start_time"], "end_time": r["end_time"], "active": r.get("is_active", True)} for r in data.rules]).execute()
    if data.breaks: supabase.table("availability_breaks").insert([{"professional_id": user["id"], "weekday": b["day_of_week"], "start_time": b["start_time"], "end_time": b["end_time"]} for b in data.breaks]).execute()
    return {"message": "Disponibilidade atualizada"}


@router.get("/appointments")
def appointments(date: str | None = None, status: str | None = None, start_date: str | None = None, end_date: str | None = None, user=Depends(current_user)):
    q = supabase.table("appointments").select("*, services(legacy_service_id)").eq("professional_id", user["id"])
    if date: q = q.eq("appointment_date", date)
    if start_date: q = q.gte("appointment_date", start_date)
    if end_date: q = q.lte("appointment_date", end_date)
    if status: q = q.eq("status", status)
    rows = q.order("appointment_date").order("start_time").execute().data
    for row in rows: row["legacy_service_id"] = (row.pop("services", {}) or {}).get("legacy_service_id")
    return [appointment_out(r) for r in rows]


@router.post("/appointments")
def create_appointment(data: Appointment, user=Depends(current_user)):
    enforce_plan_limit(user)
    start = datetime.fromisoformat(f"{data.date}T{data.start_time}").replace(tzinfo=ZoneInfo(user.get("timezone") or "America/Sao_Paulo"))
    if start <= datetime.now(ZoneInfo(user.get("timezone") or "America/Sao_Paulo")):
        raise HTTPException(400, "Não é possível agendar um horário no passado")
    service = supabase.table("services").select("*").eq("professional_id", user["id"]).eq("legacy_service_id", data.service_id).single().execute().data
    end = start + timedelta(minutes=service["duration_minutes"])
    phone = normalize_phone(data.client_phone)
    existing = supabase.table("clients").select("id").eq("professional_id", user["id"]).eq("phone_norm", phone).execute().data
    client_id = existing[0]["id"] if existing else supabase.table("clients").insert({"professional_id": user["id"], "legacy_client_id": "cli_" + secrets.token_hex(4), "name": data.client_name, "phone": data.client_phone, "phone_norm": phone, "email": data.client_email}).execute().data[0]["id"]
    legacy_id, token = "apt_" + secrets.token_hex(4), secrets.token_urlsafe(32)
    try:
        row = supabase.table("appointments").insert({"professional_id": user["id"], "service_id": service["id"], "client_id": client_id, "legacy_appointment_id": legacy_id, "client_name": data.client_name, "client_phone": data.client_phone, "client_email": data.client_email, "notes": data.notes, "start_at": start.isoformat(), "end_at": end.isoformat(), "buffer_minutes": service["buffer_minutes"], "blocked_until": (end + timedelta(minutes=service["buffer_minutes"])).isoformat(), "appointment_date": data.date, "start_time": data.start_time, "end_time": end.strftime("%H:%M"), "service_name": service["name"], "service_price": service["price_cents"], "token": token}).execute().data[0]
    except Exception as exc:
        raise HTTPException(409, "Conflito de horário") from exc
    row["legacy_service_id"] = data.service_id
    return appointment_out(row)


@router.put("/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: str, body: dict, user=Depends(current_user)):
    status = body.get("status")
    if status not in ("scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"):
        raise HTTPException(400, "Status inválido")
    rows = supabase.table("appointments").update({"status": status}).eq("professional_id", user["id"]).eq("legacy_appointment_id", appointment_id).execute().data
    if not rows: raise HTTPException(404, "Agendamento não encontrado")
    if status == "completed" and rows[0].get("client_id"):
        supabase.table("clients").update({"last_visit": datetime.now(timezone.utc).isoformat()}).eq("id", rows[0]["client_id"]).execute()
    rows[0]["legacy_service_id"] = None
    return appointment_out(rows[0])


@router.delete("/appointments/{appointment_id}")
def cancel_appointment(appointment_id: str, user=Depends(current_user)):
    rows = supabase.table("appointments").update({"status": "cancelled"}).eq("professional_id", user["id"]).eq("legacy_appointment_id", appointment_id).execute().data
    if not rows: raise HTTPException(404, "Agendamento não encontrado")
    return {"message": "Agendamento cancelado"}


def public_profile(slug: str):
    rows = supabase.table("profiles").select("*").eq("slug", slug.lower()).eq("role", "professional").execute().data
    if not rows: raise HTTPException(404, "Profissional não encontrado")
    return rows[0]


@router.get("/public/{slug}/client-lookup")
def public_client_lookup(slug: str, phone: str = Query(..., min_length=8)):
    """Reconhece clientes do profissional sem expor dados sensíveis."""
    profile = public_profile(slug)
    phone_norm = normalize_phone(phone)
    if len(phone_norm) < 10:
        return {"recognized": False}
    rows = supabase.table("clients").select("name").eq("professional_id", profile["id"]).eq("phone_norm", phone_norm).limit(1).execute().data
    return {"recognized": bool(rows), "name": rows[0]["name"] if rows else None}


@router.get("/public/{slug}")
def get_public_profile(slug: str):
    profile = public_profile(slug)
    services_rows = supabase.table("services").select("*").eq("professional_id", profile["id"]).eq("active", True).execute().data
    professional = legacy_profile(profile)
    featured_ids = profile.get("featured_service_ids") or []
    featured_rows = [service for service_id in featured_ids for service in services_rows if service["legacy_service_id"] == service_id]
    remaining_rows = [service for service in services_rows if service["legacy_service_id"] not in featured_ids]
    ordered_rows = [*featured_rows, *remaining_rows]
    return {
        "professional": professional,
        "services": [service_out(service) for service in ordered_rows],
        "featured_services": [service_out(service) for service in featured_rows],
    }


@router.get("/public/{slug}/slots")
def public_slots(slug: str, date: str, service_id: str):
    profile = public_profile(slug)
    service = supabase.table("services").select("*").eq("professional_id", profile["id"]).eq("legacy_service_id", service_id).eq("active", True).single().execute().data
    day = datetime.fromisoformat(date).date()
    now = datetime.now(ZoneInfo(profile.get("timezone") or "America/Sao_Paulo"))
    if day < now.date(): return {"slots": [], "date": date}
    rows = supabase.rpc("public_available_slots", {"p_slug": slug, "p_service_id": service["id"], "p_date": date}).execute().data
    slots = []
    for row in rows:
        start = datetime.fromisoformat(row["start_at"].replace("Z", "+00:00")).astimezone(ZoneInfo(profile.get("timezone") or "America/Sao_Paulo"))
        if start <= now + timedelta(hours=profile.get("min_advance_hours", 0)): continue
        end = start + timedelta(minutes=service["duration_minutes"])
        slots.append({"start_time": start.strftime("%H:%M"), "end_time": end.strftime("%H:%M")})
    return {"slots": slots, "date": date}


@router.post("/public/{slug}/book")
def public_book(slug: str, data: Appointment):
    profile = public_profile(slug)
    enforce_plan_limit(profile)
    service = supabase.table("services").select("*").eq("professional_id", profile["id"]).eq("legacy_service_id", data.service_id).eq("active", True).single().execute().data
    zone = ZoneInfo(profile.get("timezone") or "America/Sao_Paulo")
    start = datetime.fromisoformat(f"{data.date}T{data.start_time}").replace(tzinfo=zone)
    if start <= datetime.now(zone) + timedelta(hours=profile.get("min_advance_hours", 0)):
        raise HTTPException(400, "Este horário não está mais disponível")
    phone = normalize_phone(data.client_phone)
    existing = supabase.table("clients").select("id").eq("professional_id", profile["id"]).eq("phone_norm", phone).execute().data
    client_id = existing[0]["id"] if existing else supabase.table("clients").insert({"professional_id": profile["id"], "legacy_client_id": "cli_" + secrets.token_hex(4), "name": data.client_name, "phone": data.client_phone, "phone_norm": phone, "email": data.client_email}).execute().data[0]["id"]
    appointment_id, token = "apt_" + secrets.token_hex(4), secrets.token_urlsafe(32)
    end = start + timedelta(minutes=service["duration_minutes"])
    try:
        rows = supabase.table("appointments").insert({"professional_id": profile["id"], "service_id": service["id"], "client_id": client_id, "legacy_appointment_id": appointment_id, "client_name": data.client_name, "client_phone": data.client_phone, "client_email": data.client_email, "notes": data.notes, "start_at": start.isoformat(), "end_at": end.isoformat(), "buffer_minutes": service["buffer_minutes"], "blocked_until": (end + timedelta(minutes=service["buffer_minutes"])).isoformat(), "appointment_date": data.date, "start_time": data.start_time, "end_time": end.strftime("%H:%M"), "service_name": service["name"], "service_price": service["price_cents"], "token": token}).execute().data
    except Exception as exc:
        raise HTTPException(409, "Este horário já foi reservado. Escolha outro.") from exc
    rows[0]["legacy_service_id"] = data.service_id
    return appointment_out(rows[0])


@router.get("/appointment/manage/{token}")
def manage_appointment(token: str):
    rows = supabase.table("appointments").select("*, profiles!appointments_professional_id_fkey(full_name,business_name), services(legacy_service_id)").or_(f"token.eq.{token},manage_token.eq.{token}").execute().data
    if not rows: raise HTTPException(404, "Agendamento não encontrado")
    row = rows[0]
    row["legacy_service_id"] = (row.pop("services", {}) or {}).get("legacy_service_id")
    row["professional"] = row.pop("profiles", {})
    return appointment_out(row)


@router.post("/appointment/manage/{token}/cancel")
def manage_cancel(token: str):
    rows = supabase.table("appointments").update({"status": "cancelled"}).or_(f"token.eq.{token},manage_token.eq.{token}").in_("status", ["scheduled", "confirmed"]).execute().data
    if not rows: raise HTTPException(404, "Agendamento não encontrado ou não pode mais ser cancelado")
    return {"message": "Agendamento cancelado"}


# ==================== ASSINATURAS E PAGAMENTOS ====================
PRO_PLAN_AMOUNT_CENTS = 6990


def subscription_out(row: dict | None, profile: dict):
    return {
        "plan": "pro" if profile.get("plan") == "pro" else "freemium",
        "booking_limit": None if profile.get("plan") == "pro" else 30,
        "booking_count": monthly_booking_count(profile["id"]),
        "subscription": row,
    }


def upsert_subscription(professional_id: str, provider: str, status: str, reference: str | None = None, **extra):
    values = {
        "professional_id": professional_id,
        "provider": provider,
        "status": status,
        "amount_cents": PRO_PLAN_AMOUNT_CENTS,
        **extra,
    }
    if reference:
        values["provider_reference"] = reference
    return supabase.table("subscriptions").upsert(values, on_conflict="professional_id").execute().data[0]


def record_payment_event(provider: str, event_id: str, event_type: str, payload: dict, professional_id: str | None = None, amount_cents: int = 0, status: str = "received"):
    try:
        supabase.table("payment_events").insert({
            "provider": provider,
            "provider_event_id": event_id,
            "professional_id": professional_id,
            "event_type": event_type,
            "amount_cents": amount_cents,
            "status": status,
            "payload": payload,
        }).execute()
        return True
    except Exception:
        # Webhooks são reenviados pelos provedores; o índice único garante idempotência.
        return False


@router.get("/billing/me")
def billing_me(user=Depends(current_user)):
    rows = supabase.table("subscriptions").select("*").eq("professional_id", user["id"]).limit(1).execute().data
    return subscription_out(rows[0] if rows else None, user)


@router.post("/billing/checkout")
def create_checkout(data: CheckoutRequest, user=Depends(current_user)):
    """Inicia checkout sem expor as chaves privadas dos provedores ao navegador."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    if data.provider == "stripe":
        secret = integration_value("stripe", "secret_key", "STRIPE_SECRET_KEY")
        price = integration_value("stripe", "price_id", "STRIPE_PRICE_PRO_MONTHLY")
        if not secret or not price:
            raise HTTPException(503, "Stripe ainda não foi configurado pelo administrador")
        payload = {
            "mode": "subscription",
            "line_items[0][price]": price,
            "line_items[0][quantity]": "1",
            "customer_email": user["email"],
            "client_reference_id": user["id"],
            "success_url": f"{frontend_url}/billing?success=stripe",
            "cancel_url": f"{frontend_url}/billing?cancelled=1",
            "metadata[professional_id]": user["id"],
        }
        try:
            response = httpx.post("https://api.stripe.com/v1/checkout/sessions", data=payload, auth=(secret, ""), timeout=20)
            response.raise_for_status()
            checkout = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Não foi possível iniciar o checkout Stripe") from exc
        upsert_subscription(user["id"], "stripe", "pending", checkout["id"], provider_customer_id=checkout.get("customer"))
        return {"provider": "stripe", "checkout_url": checkout["url"]}

    if data.provider == "woovi":
        app_id = integration_value("woovi", "app_id", "WOOVI_APP_ID")
        if not app_id:
            raise HTTPException(503, "Woovi/OpenPix ainda não foi configurado pelo administrador")
        reference = f"clickagenda:{user['id']}:{uuid.uuid4().hex}"
        payload = {
            "correlationID": reference,
            "value": PRO_PLAN_AMOUNT_CENTS,
            "comment": "ClickAgenda Pro - mensal",
            "customer": {"name": user.get("full_name", ""), "email": user["email"], "phone": user.get("phone", "")},
        }
        try:
            response = httpx.post("https://api.woovi.com/api/v1/charge", json=payload, headers={"Authorization": app_id}, timeout=20)
            response.raise_for_status()
            charge = response.json().get("charge", response.json())
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Não foi possível gerar o Pix da Woovi/OpenPix") from exc
        upsert_subscription(user["id"], "woovi", "pending", reference)
        return {
            "provider": "woovi",
            "reference": reference,
            "br_code": charge.get("brCode"),
            "qr_code_image": charge.get("qrCodeImage"),
            "payment_link": charge.get("paymentLinkUrl"),
            "expires_at": charge.get("expiresDate"),
        }

    # A Stone Online exige tokenização/antifraude e credenciamento do lojista.
    # Nunca recebemos número de cartão no ClickAgenda; isso evita ampliar o escopo PCI.
    raise HTTPException(409, "A Stone exige credenciamento e um fluxo de cartão tokenizado homologado. Configure-o antes de habilitar este meio de pagamento.")


@router.post("/billing/portal")
def create_stripe_portal(user=Depends(current_user)):
    """Abre o portal hospedado pela Stripe para troca/cancelamento seguro do cartão."""
    subscription = supabase.table("subscriptions").select("provider,provider_customer_id").eq("professional_id", user["id"]).eq("provider", "stripe").limit(1).execute().data
    secret = integration_value("stripe", "secret_key", "STRIPE_SECRET_KEY")
    if not subscription or not subscription[0].get("provider_customer_id") or not secret:
        raise HTTPException(409, "Não há uma assinatura Stripe gerenciável para esta conta")
    try:
        response = httpx.post(
            "https://api.stripe.com/v1/billing_portal/sessions",
            data={"customer": subscription[0]["provider_customer_id"], "return_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/billing"},
            auth=(secret, ""),
            timeout=20,
        )
        response.raise_for_status()
        return {"url": response.json()["url"]}
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Não foi possível abrir o portal da Stripe") from exc


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("stripe-signature", "")
    secret = integration_value("stripe", "webhook_secret", "STRIPE_WEBHOOK_SECRET")
    try:
        parts = dict(item.split("=", 1) for item in signature.split(",") if "=" in item)
        timestamp, signed = parts["t"], parts["v1"]
        expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
        if not secret or not hmac.compare_digest(expected, signed):
            raise ValueError("assinatura inválida")
        if abs(datetime.now(timezone.utc).timestamp() - int(timestamp)) > 300:
            raise ValueError("assinatura expirada")
        event = json.loads(raw_body)
    except Exception as exc:
        raise HTTPException(400, "Webhook Stripe inválido") from exc

    event_type, obj = event.get("type", ""), event.get("data", {}).get("object", {})
    professional_id = obj.get("metadata", {}).get("professional_id") or obj.get("client_reference_id")
    if not record_payment_event("stripe", event.get("id", uuid.uuid4().hex), event_type, event, professional_id, obj.get("amount_paid", 0)):
        return {"received": True, "duplicate": True}
    if professional_id and event_type in {"checkout.session.completed", "invoice.paid"}:
        supabase.table("profiles").update({"plan": "pro"}).eq("id", professional_id).execute()
        upsert_subscription(professional_id, "stripe", "active", obj.get("subscription") or obj.get("id"), provider_customer_id=obj.get("customer"), provider_subscription_id=obj.get("subscription"))
    elif professional_id and event_type in {"invoice.payment_failed", "customer.subscription.deleted"}:
        upsert_subscription(professional_id, "stripe", "past_due" if event_type == "invoice.payment_failed" else "cancelled", obj.get("subscription") or obj.get("id"))
    return {"received": True}


@router.post("/webhooks/woovi")
async def woovi_webhook(request: Request):
    raw_body = await request.body()
    authorization = request.headers.get("x-openpix-authorization") or request.headers.get("authorization", "")
    expected_auth = integration_value("woovi", "webhook_authorization", "WOOVI_WEBHOOK_AUTHORIZATION")
    hmac_secret = integration_value("woovi", "webhook_hmac_secret", "WOOVI_WEBHOOK_HMAC_SECRET")
    signature = request.headers.get("x-openpix-signature", "")
    if not expected_auth or not hmac.compare_digest(authorization, expected_auth):
        raise HTTPException(401, "Webhook Woovi não autorizado")
    if hmac_secret:
        expected = hmac.new(hmac_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(expected, signature):
            raise HTTPException(401, "Assinatura Woovi inválida")
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Payload Woovi inválido") from exc
    event_type = event.get("event", "")
    charge = event.get("data", {}).get("charge", event.get("charge", {}))
    reference = charge.get("correlationID", "")
    professional_id = reference.split(":")[1] if reference.startswith("clickagenda:") and len(reference.split(":")) >= 3 else None
    event_id = event.get("eventId") or charge.get("transactionID") or hashlib.sha256(raw_body).hexdigest()
    if not record_payment_event("woovi", event_id, event_type, event, professional_id, charge.get("value", 0)):
        return {"received": True, "duplicate": True}
    if professional_id and event_type == "OPENPIX:CHARGE_COMPLETED":
        supabase.table("profiles").update({"plan": "pro"}).eq("id", professional_id).execute()
        upsert_subscription(professional_id, "woovi", "active", reference, current_period_end=(datetime.now(timezone.utc) + timedelta(days=30)).isoformat())
    return {"received": True}


# ==================== SUPERADMIN, MÉTRICAS E PIXEL ====================
@router.get("/admin/overview")
def admin_overview(admin=Depends(require_superadmin)):
    now = datetime.now(timezone.utc)
    profiles = supabase.table("profiles").select("id,role,plan,created_at").execute().data
    try:
        payments = supabase.table("payment_events").select("amount_cents,status,created_at").execute().data
    except Exception:
        # Permite que a visão geral continue disponível durante a implantação
        # da migração comercial; receita aparece como zero até a tabela existir.
        logger.warning("Tabela payment_events ainda não está disponível")
        payments = []
    appointments = supabase.table("appointments").select("id,created_at").execute().data
    six_months = []
    for offset in range(5, -1, -1):
        month = (now.replace(day=1) - timedelta(days=offset * 28)).replace(day=1)
        key = month.strftime("%Y-%m")
        six_months.append({"month": month.strftime("%b/%y"), "key": key, "professionals": 0, "bookings": 0, "revenue": 0})
    buckets = {item["key"]: item for item in six_months}
    for row in profiles:
        key = str(row.get("created_at", ""))[:7]
        if row.get("role") == "professional" and key in buckets: buckets[key]["professionals"] += 1
    for row in appointments:
        key = str(row.get("created_at", ""))[:7]
        if key in buckets: buckets[key]["bookings"] += 1
    for row in payments:
        key = str(row.get("created_at", ""))[:7]
        if row.get("status") in {"paid", "received"} and key in buckets: buckets[key]["revenue"] += row.get("amount_cents", 0) / 100
    professional_rows = [p for p in profiles if p.get("role") == "professional"]
    month_key = now.strftime("%Y-%m")
    return {
        "professionals": len(professional_rows),
        "new_professionals_month": len([p for p in professional_rows if str(p.get("created_at", ""))[:7] == month_key]),
        "pro_accounts": len([p for p in professional_rows if p.get("plan") == "pro"]),
        "freemium_accounts": len([p for p in professional_rows if p.get("plan") != "pro"]),
        "bookings_month": len([p for p in appointments if str(p.get("created_at", ""))[:7] == month_key]),
        "revenue_month": round(buckets.get(month_key, {}).get("revenue", 0), 2),
        "trend": six_months,
    }


@router.get("/admin/professionals")
def admin_professionals(admin=Depends(require_superadmin)):
    rows = supabase.table("profiles").select("id,full_name,business_name,slug,plan,created_at,role").eq("role", "professional").order("created_at", desc=True).execute().data
    # O e-mail fica no Supabase Auth e não é exposto por PostgREST; a tela usa nome e negócio.
    return rows


@router.put("/admin/professionals/{professional_id}/plan")
def admin_change_plan(professional_id: str, data: PlanChange, admin=Depends(require_superadmin)):
    rows = supabase.table("profiles").update({"plan": data.plan}).eq("id", professional_id).eq("role", "professional").execute().data
    if not rows:
        raise HTTPException(404, "Profissional não encontrado")
    try:
        upsert_subscription(professional_id, "manual", data.status, f"manual:{professional_id}")
        supabase.table("admin_audit_logs").insert({"actor_id": admin["id"], "action": "plan_changed", "target_id": professional_id, "metadata": {"plan": data.plan, "status": data.status}}).execute()
    except Exception:
        logger.warning("Plano alterado sem histórico comercial: migração pendente")
    return legacy_profile(rows[0])


@router.get("/admin/settings/pixel")
def admin_pixel(admin=Depends(require_superadmin)):
    try:
        rows = supabase.table("platform_settings").select("value").eq("key", "facebook_pixel").execute().data
    except Exception:
        rows = []
    return rows[0]["value"] if rows else {"pixel_id": ""}


@router.get("/admin/integrations")
def admin_integrations(request: Request, admin=Depends(require_superadmin)):
    """Estado seguro das integrações: nunca retorna chaves, somente prontidão."""
    base_url = os.getenv("BACKEND_PUBLIC_URL", str(request.base_url).rstrip("/"))
    try:
        stored = load_credentials(supabase)
    except HTTPException:
        stored = {}
    stripe = (stored.get("stripe") or {}).get("values") or {}
    woovi = (stored.get("woovi") or {}).get("values") or {}
    stone = (stored.get("stone") or {}).get("values") or {}
    return {
        "stripe": {
            "configured": bool((stripe.get("secret_key") or os.getenv("STRIPE_SECRET_KEY")) and (stripe.get("price_id") or os.getenv("STRIPE_PRICE_PRO_MONTHLY")) and (stripe.get("webhook_secret") or os.getenv("STRIPE_WEBHOOK_SECRET"))),
            "webhook_url": f"{base_url}/api/webhooks/stripe",
            "required": ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_WEBHOOK_SECRET"],
            "description": "Cartão e assinaturas recorrentes via Checkout hospedado.",
            "saved": {"secret_key": masked(stripe.get("secret_key")), "price_id": masked(stripe.get("price_id")), "webhook_secret": masked(stripe.get("webhook_secret"))},
        },
        "woovi": {
            "configured": bool((woovi.get("app_id") or os.getenv("WOOVI_APP_ID")) and (woovi.get("webhook_authorization") or os.getenv("WOOVI_WEBHOOK_AUTHORIZATION"))),
            "webhook_url": f"{base_url}/api/webhooks/woovi",
            "required": ["WOOVI_APP_ID", "WOOVI_WEBHOOK_AUTHORIZATION"],
            "description": "Pix para assinatura Pro com confirmação por webhook.",
            "saved": {"app_id": masked(woovi.get("app_id")), "webhook_authorization": masked(woovi.get("webhook_authorization")), "webhook_hmac_secret": masked(woovi.get("webhook_hmac_secret"))},
        },
        "stone": {
            "configured": bool(stone.get("bearer_token")),
            "webhook_url": "",
            "required": ["Credenciamento Stone", "Tokenização de cartão", "Antifraude homologado"],
            "description": "Bloqueada com segurança até o fluxo tokenizado da sua conta Stone estar homologado.",
            "saved": {"bearer_token": masked(stone.get("bearer_token")), "merchant_id": masked(stone.get("merchant_id"))},
        },
    }


@router.post("/admin/integrations")
def save_admin_integration(data: IntegrationCredentials, admin=Depends(require_superadmin)):
    saved = save_credentials(supabase, data.provider, data.values, admin["id"])
    try:
        supabase.table("admin_audit_logs").insert({"actor_id": admin["id"], "action": "integration_credentials_updated", "metadata": {"provider": data.provider, "fields": list(data.values)}}).execute()
    except Exception:
        pass
    return {"provider": data.provider, "updated_at": saved["updated_at"]}


@router.delete("/admin/integrations/{provider}")
def remove_admin_integration(provider: str, admin=Depends(require_superadmin)):
    if provider not in {"stripe", "woovi", "stone"}:
        raise HTTPException(404, "Integração não encontrada")
    delete_credentials(supabase, provider)
    return {"message": "Credenciais removidas"}


@router.get("/admin/security/status")
def admin_security_status(admin=Depends(require_superadmin)):
    try:
        storage_ready = any(bucket.name == PROFILE_MEDIA_BUCKET for bucket in supabase.storage.list_buckets())
    except Exception:
        storage_ready = False
    try:
        # As tabelas comerciais são aplicadas na migração 0002. Expor somente
        # a prontidão ao superadmin torna a pendência visível sem revelar dados.
        supabase.table("subscriptions").select("id").limit(1).execute()
        supabase.table("payment_events").select("id").limit(1).execute()
        supabase.table("platform_settings").select("key").limit(1).execute()
        commercial_schema_ready = True
    except Exception:
        commercial_schema_ready = False
    return {
        "environment": os.getenv("APP_ENV", "development"),
        "storage_ready": storage_ready,
        "commercial_schema_ready": commercial_schema_ready,
        "cors_configured": bool(os.getenv("CORS_ORIGINS")),
        "superadmin_allowlist": bool(os.getenv("SUPERADMIN_EMAILS")),
        "auth_rate_limit": "10 tentativas / 10 min por IP",
        "booking_rate_limit": "20 reservas / min por IP",
        "session_cookie": "HTTP-only; Secure em produção; SameSite=Lax",
    }


@router.put("/admin/settings/pixel")
def save_admin_pixel(data: PixelSettings, admin=Depends(require_superadmin)):
    value = {"pixel_id": data.pixel_id}
    supabase.table("platform_settings").upsert({"key": "facebook_pixel", "value": value, "updated_by": admin["id"]}, on_conflict="key").execute()
    supabase.table("admin_audit_logs").insert({"actor_id": admin["id"], "action": "facebook_pixel_changed", "metadata": {"enabled": bool(data.pixel_id)}}).execute()
    return value


@router.get("/public/platform/pixel")
def public_facebook_pixel():
    try:
        rows = supabase.table("platform_settings").select("value").eq("key", "facebook_pixel").execute().data
    except Exception:
        rows = []
    return rows[0]["value"] if rows else {"pixel_id": ""}
