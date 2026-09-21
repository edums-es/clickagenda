-- Comercial, pagamentos e governança do ClickAgenda.
-- Aplicar depois da 0001 no SQL Editor/CLI do Supabase.

-- Restored installations can have the tables but lack this helper.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('professional', 'client', 'superadmin'));

alter table public.profiles alter column plan set default 'freemium';
update public.profiles set plan = 'freemium' where plan in ('free', '');
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('freemium', 'pro'));

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'woovi', 'stone', 'manual')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_reference text unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  amount_cents integer not null default 6990 check (amount_cents >= 0),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'woovi', 'stone', 'manual')),
  provider_event_id text not null,
  professional_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  amount_cents integer not null default 0,
  status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute procedure public.set_updated_at();

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists payment_events_created_at_idx on public.payment_events(created_at desc);
create index if not exists payment_events_professional_idx on public.payment_events(professional_id, created_at desc);

alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- A chave service_role é usada exclusivamente pelo backend. Não criar políticas
-- para anon/authenticated evita expor assinaturas, eventos de pagamento ou dados administrativos.
