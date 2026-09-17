# ClickAgenda

Agenda online para profissionais e pequenos negócios: página pública personalizada,
agenda, serviços, clientes e reservas em tempo real.

## Arquitetura

- Frontend: React + Tailwind CSS + Shadcn/UI
- Backend: FastAPI
- Dados e autenticação: Supabase (Postgres + Auth + Storage)
- Planos: Freemium (30 reservas/mês) e Pro (R$ 69,90/mês)

## Rodar localmente

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

```bash
cd frontend
npm install
npm start
```

Antes de iniciar, aplique `backend/supabase/migrations/0001_clickagenda_core.sql`
e `backend/supabase/migrations/0002_billing_admin_security.sql` no SQL Editor
do projeto Supabase.

## Configuração comercial

O backend só ativa cada meio de pagamento depois das respectivas variáveis de
ambiente serem configuradas. Consulte `backend/.env.example`; segredos nunca
devem ser colocados no frontend ou versionados.

Para promover o primeiro superadmin, coloque o e-mail dele em
`SUPERADMIN_EMAILS` e reinicie a API. Essa pessoa poderá administrar planos e
o Pixel Meta em `/superadmin`.
