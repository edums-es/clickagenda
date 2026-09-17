"""Cofre de credenciais das integrações.

Os segredos são criptografados antes de sair do processo da API e ficam em um
bucket privado. O navegador recebe apenas metadados mascarados.
"""
import json
import os
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException


VAULT_BUCKET = "platform-secrets"
VAULT_PATH = "system/integration-credentials.enc"


def _cipher() -> Fernet:
    key = os.getenv("INTEGRATION_ENCRYPTION_KEY", "")
    if not key:
        raise HTTPException(503, "O cofre de integrações ainda não foi configurado no servidor")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise HTTPException(503, "A chave de criptografia das integrações é inválida") from exc


def _ensure_bucket(supabase):
    buckets = supabase.storage.list_buckets()
    if not any(bucket.name == VAULT_BUCKET for bucket in buckets):
        supabase.storage.create_bucket(VAULT_BUCKET, options={"public": False})


def load_credentials(supabase) -> dict:
    _ensure_bucket(supabase)
    try:
        encrypted = supabase.storage.from_(VAULT_BUCKET).download(VAULT_PATH)
    except Exception:
        return {}
    try:
        return json.loads(_cipher().decrypt(encrypted).decode("utf-8"))
    except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(500, "Não foi possível ler o cofre de integrações") from exc


def save_credentials(supabase, provider: str, values: dict, actor_id: str) -> dict:
    credentials = load_credentials(supabase)
    previous_values = (credentials.get(provider) or {}).get("values") or {}
    credentials[provider] = {
        # Campos vazios não apagam credenciais já guardadas. Isso permite, por
        # exemplo, trocar apenas a chave de webhook sem perder a chave Stripe.
        "values": {**previous_values, **values},
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": actor_id,
    }
    encrypted = _cipher().encrypt(json.dumps(credentials, separators=(",", ":")).encode("utf-8"))
    supabase.storage.from_(VAULT_BUCKET).upload(
        VAULT_PATH,
        encrypted,
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
    )
    return credentials[provider]


def delete_credentials(supabase, provider: str) -> None:
    credentials = load_credentials(supabase)
    credentials.pop(provider, None)
    encrypted = _cipher().encrypt(json.dumps(credentials, separators=(",", ":")).encode("utf-8"))
    supabase.storage.from_(VAULT_BUCKET).upload(
        VAULT_PATH,
        encrypted,
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
    )


def provider_values(supabase, provider: str) -> dict:
    return (load_credentials(supabase).get(provider) or {}).get("values") or {}


def masked(value: str | None) -> str:
    if not value:
        return ""
    return "••••" + value[-4:]
