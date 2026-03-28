# ClickAgenda

Plataforma de agendamento online para profissionais autônomos e pequenos negócios. 
Link público personalizável, agenda inteligente e notificações via WhatsApp.

## Stack

- **Frontend:** React 19 + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Banco:** MongoDB (Motor async)
- **Auth:** Sessões JWT + Google OAuth

## Rodando localmente

### Backend
```bash
cd backend
cp .env.example .env
# edite o .env com suas variáveis
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

### Frontend
```bash
cd frontend
cp .env.example .env  # REACT_APP_BACKEND_URL=http://localhost:8000
yarn install
yarn start
```

## Variáveis de ambiente obrigatórias

Veja `backend/.env.example` para a lista completa.

## Status

Beta em desenvolvimento — não use em produção sem configurar CORS e JWT_SECRET.

Observações importantes

Não altere nenhuma lógica de negócio (slots, agendamentos, auth)
Não altere nenhum endpoint existente além das modificações descritas acima
Não remova nenhuma importação existente, apenas adicione as novas
Após as alterações, rode uvicorn server:app --reload e confirme que a API sobe sem erros
Confirme que POST /api/auth/login com body {"email":"test@test.com","password":"123"} retorna 401 (não 500)
