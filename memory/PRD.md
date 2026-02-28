# Click Agenda - PRD (Product Requirements Document)

## Problema Original
Plataforma web PWA de gestao + agendamento inteligente para profissionais (saloes, clinicas, terapeutas).

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco**: MongoDB (Motor async driver)
- **Auth**: JWT sessions + Google OAuth (Emergent Auth)
- **Design**: "Soft Utility" theme (Deep Teal + Rose/Coral + Warm Stone)

## Personas
1. **Manicure autonoma** - usa pelo celular, precisa de pagina publica para compartilhar no WhatsApp
2. **Clinica com 5 profissionais** - precisa de multi-profissional e gestao de recursos
3. **Psicologo online** - precisa de agendamento simples e confirmacoes automaticas

## O que foi implementado (MVP - Fev 2026)

### Backend (FastAPI)
- Auth completa (registro, login, Google OAuth, sessoes, logout)
- CRUD de servicos (nome, duracao, preco, buffer, categoria)
- CRUD de clientes (nome, telefone, email, tags, observacoes)
- CRUD de agendamentos com deteccao de conflitos
- Gerenciamento de disponibilidade (regras por dia, intervalos)
- Calculo de slots disponiveis em tempo real
- Endpoints publicos (perfil, servicos, agendamento)
- Dashboard com estatisticas
- WhatsApp mock (estrutura pronta para Evolution API)
- Gerenciamento de agendamento via token seguro (confirmar/cancelar)
- Indices MongoDB para performance

### Frontend (React)
- Landing page com hero, features, how-it-works, CTA
- Login/Register com email/senha + Google OAuth
- Dashboard com stats cards e agenda do dia
- Calendario inteligente com visao diaria e mini calendario
- Gestao de clientes (busca, CRUD com dialog)
- Gestao de servicos (CRUD com cards e dialog)
- Configuracoes (perfil, horarios, pagina publica)
- Pagina publica do profissional (/p/:slug)
- Fluxo de agendamento multi-step (servico -> data/hora -> dados -> confirmacao)
- Pagina de gerenciamento de agendamento via token
- Sidebar responsiva (desktop + mobile sheet)
- Design system "Soft Utility" implementado

## Backlog Priorizado

### P0 (Proxima iteracao)
- [ ] Turbo Preenchimento (ofertas relampago para horarios vagos)
- [ ] Fila de espera inteligente
- [ ] Notificacoes push PWA
- [ ] Multi-profissional (equipe)

### P1
- [ ] Relatorios avancados (agendamentos, receita, taxa de faltas)
- [ ] Arrastar e soltar no calendario para reagendar
- [ ] Recorrencia inteligente (sugerir proximos agendamentos)
- [ ] Avaliacao pos-atendimento
- [ ] Super admin panel

### P2
- [ ] Integracao real WhatsApp (Evolution API)
- [ ] Pagamentos online / sinal (Stripe/PIX)
- [ ] Campanhas e marketing
- [ ] Multi-tenant completo
- [ ] PWA offline completo com service worker
