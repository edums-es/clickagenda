# Click Agenda — MVP Fix Prompt

## Contexto do projeto

Stack: **FastAPI (Python)** no backend (`backend/server.py`), **React 19** no frontend (`src/`), **MongoDB** via Motor async. Auth por cookie `session_token` + Google OAuth. Sem framework de tasks assíncronas — tudo síncrono no request/response cycle por enquanto.

Não refatore código que não está listado abaixo. Não mude nomes de rotas existentes. Não altere o schema de nenhuma collection MongoDB existente — apenas adicione campos opcionais ou crie novas collections.

---

## BLOCO 1 — Bloqueadores críticos (aplicar todos antes de qualquer deploy)

---

### Fix 1 · Notificação de agendamento via e-mail (substitui o mock de WhatsApp)

**Problema:** A função `mock_send_whatsapp()` em `backend/server.py` (linha ~1150) apenas salva um documento na collection `whatsapp_messages` e loga no console. Nenhuma notificação real chega ao cliente ou ao profissional quando um agendamento é criado.

**Solução:** Integrar o serviço **Resend** (resend.com) para enviar e-mail transacional de confirmação. O Resend foi escolhido por ter SDK Python oficial, plano gratuito generoso (3.000 e-mails/mês) e setup em menos de 10 linhas.

**Instruções exatas:**

1. Adicionar `resend` ao `backend/requirements.txt`.

2. Adicionar as seguintes variáveis ao `backend/.env.example` (e ao `.env` real):
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM=noreply@seudominio.com.br
   ```

3. No topo de `backend/server.py`, após os imports existentes, adicionar:
   ```python
   import resend
   resend.api_key = os.environ.get("RESEND_API_KEY", "")
   EMAIL_FROM = os.environ.get("EMAIL_FROM", "noreply@clickagenda.com.br")
   EMAIL_ENABLED = bool(os.environ.get("RESEND_API_KEY", ""))
   ```

4. Criar a função `send_confirmation_email` logo abaixo de `mock_send_whatsapp`. Ela deve:
   - Receber `appointment: dict`, `professional: dict` (documento do usuário profissional) e `recipient: Literal["client", "professional"]`.
   - Montar um HTML simples em português com os dados do agendamento (serviço, data, horário, nome do cliente, nome do profissional, link de gerenciamento via token).
   - Enviar para o e-mail correto: se `recipient == "client"`, usar `appointment["client_email"]`; se `recipient == "professional"`, usar `professional["email"]`.
   - Ignorar silenciosamente (apenas logar warning) se `appointment["client_email"]` estiver vazio no caso do cliente, ou se `EMAIL_ENABLED` for `False`.
   - Envolver o envio em try/except para nunca lançar exceção e interromper o fluxo de agendamento.

5. Substituir **todas** as chamadas a `await mock_send_whatsapp(...)` — que ocorrem nos endpoints `create_appointment`, `public_book`, `book_via_quick_link` e `book_turbo_offer` — por duas chamadas paralelas usando `asyncio.gather`:
   ```python
   import asyncio
   await asyncio.gather(
       send_confirmation_email(appointment_doc, professional_user, "client"),
       send_confirmation_email(appointment_doc, professional_user, "professional"),
       return_exceptions=True
   )
   ```
   A função `mock_send_whatsapp` deve ser **mantida** (para não quebrar o log de WhatsApp existente) e continuar sendo chamada junto.

6. **Não remover** o endpoint `GET /api/whatsapp/log` nem a collection `whatsapp_messages`. Apenas adicionar o e-mail em paralelo.

---

### Fix 2 · Fluxo de "esqueci minha senha"

**Problema:** Não existe nenhum endpoint de reset de senha no backend nem tela correspondente no frontend. Usuários que esquecem a senha ficam permanentemente bloqueados.

**Solução:** Implementar o fluxo padrão de dois passos: (1) solicitar reset por e-mail, (2) usar token para definir nova senha.

**Backend — criar dois endpoints novos em `backend/server.py`:**

Adicionar dois novos models Pydantic antes das rotas:
```python
class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
```

**Endpoint 1:** `POST /api/auth/forgot-password`
- Rate limit: `@limiter.limit("3/minute")`.
- Buscar usuário pelo e-mail. Se não existir, retornar `{"message": "Se o e-mail existir, você receberá um link."}` (não revelar se existe ou não).
- Se existir: gerar `token = secrets.token_urlsafe(48)`, salvar na collection `password_reset_tokens` com os campos `{ token, user_id, email, expires_at: agora + 1 hora, used: false }`.
- Enviar e-mail via Resend com o link `{FRONTEND_URL}/redefinir-senha?token={token}`. Adicionar `FRONTEND_URL` ao `.env.example`.
- Sempre retornar a mesma mensagem neutra independente do resultado.

**Endpoint 2:** `POST /api/auth/reset-password`
- Rate limit: `@limiter.limit("5/minute")`.
- Buscar o token na collection `password_reset_tokens` onde `used == false` e `expires_at > agora`.
- Se inválido ou expirado: HTTPException 400 `"Token inválido ou expirado"`.
- Se válido: fazer `hash_password(data.new_password)` e atualizar `password_hash` do usuário. Marcar o token como `used: true`. Retornar `{"message": "Senha redefinida com sucesso"}`.
- Não criar sessão automaticamente — o usuário deve fazer login normalmente depois.

Adicionar ao `startup()`:
```python
await db.password_reset_tokens.create_index("token", unique=True, background=True)
await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0, background=True)
```
O TTL index do MongoDB vai limpar os tokens expirados automaticamente.

**Frontend — criar dois componentes novos:**

**`src/pages/ForgotPassword.js`:**
- Tela simples com campo de e-mail e botão "Enviar link".
- Chama `POST /api/auth/forgot-password`.
- Após submit (sucesso ou erro), mostrar a mesma mensagem: "Se o e-mail estiver cadastrado, você receberá um link em breve."
- Link "Voltar ao login" no rodapé.

**`src/pages/ResetPassword.js`:**
- Ler o `token` da query string (`useSearchParams`).
- Formulário com dois campos: "Nova senha" e "Confirmar nova senha".
- Validar que as senhas coincidem antes de submeter.
- Chamar `POST /api/auth/reset-password` com `{ token, new_password }`.
- Em caso de sucesso: toast de sucesso + `navigate("/login")`.
- Em caso de erro 400: mostrar "Link inválido ou expirado. Solicite um novo."

**`src/pages/Login.js`:**
- Adicionar link "Esqueci minha senha" logo abaixo do campo de senha, apontando para `/esqueci-senha`.

**`src/App.js`:**
- Importar e registrar as duas novas rotas públicas:
  ```jsx
  <Route path="/esqueci-senha" element={<ForgotPassword />} />
  <Route path="/redefinir-senha" element={<ResetPassword />} />
  ```
- Adicionar os dois paths na lista de `isPublicRoute` dentro do interceptor do axios em `src/lib/api.js`.

---

### Fix 3 · Upload de imagens para armazenamento persistente (Cloudflare R2)

**Problema:** O endpoint `POST /api/profile/upload` (linha ~605 de `backend/server.py`) salva arquivos em `backend/uploads/` no disco local. Em containers efêmeros (Railway, Render, Fly.io), qualquer restart ou redeploy apaga todos os arquivos. Além disso, a URL retornada usa `request.base_url` que pode mudar.

**Solução:** Usar **Cloudflare R2** via SDK `boto3` (compatível com S3). O R2 tem egress gratuito e 10GB de storage no plano gratuito.

**Instruções exatas:**

1. Adicionar ao `backend/requirements.txt`: `boto3`

2. Adicionar ao `backend/.env.example`:
   ```
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET_NAME=clickagenda-uploads
   R2_PUBLIC_URL=https://pub-xxxx.r2.dev
   ```

3. No topo de `backend/server.py`, após os imports existentes, adicionar:
   ```python
   import boto3
   from botocore.config import Config as BotocoreConfig

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
       R2_BUCKET = os.environ.get("R2_BUCKET_NAME", "clickagenda-uploads")
       R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
   else:
       r2_client = None
       R2_BUCKET = ""
       R2_PUBLIC_URL = ""
   ```

4. Substituir o corpo de `upload_profile_image` para:
   - Manter toda a validação existente (tipo de imagem, content-type, tamanho máximo de 5MB).
   - Se `R2_ENABLED`: fazer `r2_client.put_object(Bucket=R2_BUCKET, Key=saved_name, Body=content, ContentType=file.content_type)` e retornar `{"url": f"{R2_PUBLIC_URL}/{saved_name}"}`.
   - Se `R2_ENABLED == False` (fallback para desenvolvimento local): manter o comportamento atual de salvar em disco e retornar a URL local.
   - Envolver o upload R2 em try/except; em caso de falha, logar o erro e retornar HTTPException 500 `"Erro ao fazer upload da imagem"`.

5. **Não remover** a lógica de fallback local. O app deve continuar funcionando em desenvolvimento sem as credenciais R2.

---

### Fix 4 · CORS seguro em produção + validação no startup

**Problema:** Se `CORS_ORIGINS` não estiver configurado na variável de ambiente, o backend assume `allow_origins=["*"]` (linha ~1695 de `backend/server.py`). Isso permite que qualquer domínio faça requisições autenticadas com cookies.

**Solução:** Tornar o comportamento diferente entre desenvolvimento e produção, e adicionar validação explícita.

**Instruções exatas:**

1. Adicionar ao `backend/.env.example`:
   ```
   APP_ENV=development
   # Em produção: APP_ENV=production
   # CORS_ORIGINS=https://app.clickagenda.com.br
   ```

2. Substituir o bloco de configuração de CORS (linhas ~1694-1718 de `backend/server.py`) por:
   ```python
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
   ```

3. No `startup()`, adicionar no início da função (antes de criar os indexes):
   ```python
   if APP_ENV == "production" and not os.environ.get("CORS_ORIGINS"):
       raise RuntimeError("FATAL: CORS_ORIGINS obrigatório em produção.")
   if APP_ENV == "production" and os.environ.get("JWT_SECRET") == "troque-por-um-valor-aleatorio-seguro":
       raise RuntimeError("FATAL: JWT_SECRET não foi alterado. Use um valor seguro em produção.")
   ```

---

## BLOCO 2 — Itens importantes (aplicar antes de abrir para mais usuários)

---

### Fix 5 · Rate limit nos endpoints públicos de booking

**Problema:** Os endpoints `POST /api/public/{slug}/book`, `POST /api/ql/{code}/book` e `POST /api/turbo-offers/{offer_id}/book` não têm rate limit. Um bot pode criar centenas de agendamentos falsos.

**Solução:** Adicionar decorator `@limiter.limit()` em cada um dos três endpoints.

Adicionar imediatamente acima de cada uma das três funções de booking público:
```python
@limiter.limit("10/minute")
```
Os decorators devem ficar entre o `@api_router.post(...)` e o `async def`, e a função deve receber `request: Request` como primeiro parâmetro (já recebe nos três casos — verificar e manter).

---

### Fix 6 · TTL index para limpeza automática de sessões expiradas

**Problema:** A collection `user_sessions` acumula sessões indefinidamente. Sessions expiram após 7 dias pela lógica da aplicação, mas o documento nunca é removido do banco.

**Solução:** Adicionar TTL index no MongoDB que remove documentos automaticamente após a data de expiração.

No `startup()`, adicionar junto aos outros indexes:
```python
await db.user_sessions.create_index(
    "expires_at",
    expireAfterSeconds=0,
    background=True
)
```

**Atenção:** O campo `expires_at` está sendo salvo como string ISO (`datetime.now().isoformat()`) em `create_session()`. O TTL index do MongoDB só funciona com campos do tipo `Date` (BSON). É necessário alterar `create_session()` para salvar `expires_at` como `datetime` nativo (não como string):
```python
# Antes:
"expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
# Depois:
"expires_at": datetime.now(timezone.utc) + timedelta(days=7)
```
Fazer a mesma correção para `created_at` na mesma função (salvar como `datetime`, não string). Verificar se outros campos de data no mesmo documento também precisam da correção e aplicar consistentemente.

---

### Fix 7 · Tratamento de erro global no frontend

**Problema:** O interceptor axios em `src/lib/api.js` só trata o erro 401. Erros 500, timeout e falhas de rede chegam como exceções não tratadas, causando telas brancas ou comportamentos inesperados.

**Solução:** Expandir o interceptor em `src/lib/api.js` para cobrir os casos faltantes.

Substituir o bloco `return Promise.reject(error)` no interceptor por:
```javascript
// Erro de rede / timeout (sem response)
if (!error.response) {
  toast.error("Sem conexão com o servidor. Verifique sua internet.");
  return Promise.reject(error);
}

const status = error.response?.status;

// 401 — já tratado acima (redirect para login)
if (status === 401) { /* ... código existente ... */ }

// 429 — rate limit
if (status === 429) {
  toast.error("Muitas tentativas. Aguarde alguns segundos e tente novamente.");
  return Promise.reject(error);
}

// 500+ — erro interno do servidor
if (status >= 500) {
  toast.error("Algo deu errado no servidor. Tente novamente em instantes.");
  return Promise.reject(error);
}
```
Importar `toast` do `sonner` no topo de `src/lib/api.js` se ainda não estiver importado.

---

### Fix 8 · URL do backend configurável por variável de ambiente no build

**Problema:** Se `REACT_APP_BACKEND_URL` não estiver definido no build, o frontend constrói a URL como `window.location.hostname:8000`. Em produção com proxy reverso (nginx, Cloudflare Tunnel), a porta 8000 não é exposta publicamente e as chamadas de API falham silenciosamente.

**Solução:** A lógica de fallback em `src/lib/api.js` já está correta para desenvolvimento. O problema é garantir que o build de produção sempre tenha a variável definida.

1. Criar o arquivo `frontend/.env.example` (se não existir) com:
   ```
   REACT_APP_BACKEND_URL=https://api.seudominio.com.br
   ```

2. Criar `frontend/.env.production.example` com:
   ```
   REACT_APP_BACKEND_URL=https://api.clickagenda.com.br
   ```

3. Adicionar ao `README.md` do frontend uma seção "Deploy" explicando que `REACT_APP_BACKEND_URL` deve ser definido antes de rodar `npm run build`.

4. **Não alterar** a lógica de `src/lib/api.js` — o fallback para `hostname:8000` é aceitável em desenvolvimento.

---

### Fix 9 · Enforcement básico de planos (limites do plano free)

**Problema:** O campo `plan` existe no banco (`"free"` por padrão), mas nenhum endpoint verifica o plano antes de executar ações. Um usuário free tem acesso ilimitado a tudo.

**Solução:** Implementar limites mínimos apenas para os recursos mais relevantes para monetização, sem criar uma camada de permissões complexa.

**Criar helper em `backend/server.py`:**
```python
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
```

**Adicionar chamadas ao helper nos endpoints:**
- `create_service`: adicionar `await check_plan_limit(user, "services", "services")` no início do handler, antes de qualquer escrita.
- `create_quick_link`: adicionar `await check_plan_limit(user, "quick_links", "quick_links")`.
- `create_turbo_offer`: adicionar `await check_plan_limit(user, "turbo_offers", "turbo_offers")`.

**Não implementar** lógica de cobrança, Stripe, ou atualização de plano agora. O upgrade de plano será manual (admin atualiza o campo `plan` no banco diretamente) durante o beta.

---

## Verificação final

Após aplicar todos os fixes, verificar:

- [ ] `backend/requirements.txt` inclui `resend` e `boto3`
- [ ] `backend/.env.example` tem todas as novas variáveis documentadas
- [ ] Nenhuma rota existente teve seu path alterado
- [ ] Nenhum campo existente foi removido de nenhum documento MongoDB
- [ ] O app sobe normalmente em desenvolvimento sem `RESEND_API_KEY` e sem credenciais R2 (modo degradado sem e-mail e sem R2 é aceitável em dev)
- [ ] Em produção, se `APP_ENV=production` e `CORS_ORIGINS` estiver vazio, o servidor deve **recusar inicializar** com erro claro no log
- [ ] As duas novas rotas do frontend (`/esqueci-senha` e `/redefinir-senha`) são públicas (não precisam de auth)
- [ ] O fluxo de reset de senha funciona end-to-end: solicitar → receber e-mail → clicar link → digitar nova senha → login com nova senha
