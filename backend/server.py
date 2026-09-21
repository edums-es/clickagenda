"""Servidor ClickAgenda: apenas FastAPI + Supabase.

Não há camada de compatibilidade com a base legada neste processo. Dados de
agenda, autenticação, pagamentos e administração passam exclusivamente pelo Supabase.
"""
import os
import logging
import threading
from collections import defaultdict, deque
from pathlib import Path
from time import monotonic

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
# Esta instância local tem um .env explícito; ele vence variáveis residuais de
# outros processos. No deploy não há esse arquivo e as variáveis do provedor
# continuam sendo usadas normalmente.
load_dotenv(ROOT_DIR / ".env", override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("clickagenda")

if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")

APP_ENV = os.getenv("APP_ENV", "development")
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
if APP_ENV == "production" and not cors_origins_raw:
    raise RuntimeError("CORS_ORIGINS é obrigatório em produção")
cors_origins = [item.strip() for item in cors_origins_raw.split(",") if item.strip()] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app = FastAPI(title="ClickAgenda API", version="2.0.0", docs_url=None if APP_ENV == "production" else "/docs")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Stripe-Signature", "X-OpenPix-Authorization", "X-OpenPix-Signature"],
)


class MemoryRateLimit:
    """Limite simples por IP para reduzir força bruta e abuso público.

    Em múltiplas réplicas, substituir por um contador Redis/Upstash antes de
    escalar horizontalmente.
    """
    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def allowed(self, key: str, limit: int, window: int) -> bool:
        now = monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True


rate_limit = MemoryRateLimit()


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    path = request.url.path
    client_ip = request.client.host if request.client else "unknown"
    if path in {"/api/auth/login", "/api/auth/register"}:
        policy = (10, 600, "auth")
    elif path.startswith("/api/public/") and request.method == "POST":
        policy = (20, 60, "booking")
    elif path.startswith("/api/"):
        policy = (240, 60, "api")
    else:
        policy = None
    if policy and not rate_limit.allowed(f"{policy[2]}:{client_ip}", policy[0], policy[1]):
        return JSONResponse({"detail": "Muitas tentativas. Aguarde e tente novamente."}, status_code=429)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


from supabase_core import router as supabase_router  # noqa: E402

app.include_router(supabase_router)


@app.get("/health")
def health():
    return {"status": "ok", "database": "supabase", "environment": APP_ENV, "revision": os.getenv("RAILWAY_GIT_COMMIT_SHA", "local")}
