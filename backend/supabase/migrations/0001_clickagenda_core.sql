-- ClickAgenda: núcleo de dados para o backend FastAPI em supabase_core.py.
-- Aplique no SQL Editor do Supabase ou com a CLI: supabase db push.

create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'professional' check (role in ('professional', 'client')),
  slug text unique,
  business_name text not null default '',
  phone text not null default '',
  bio text not null default '',
  business_type text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  picture text not null default '',
  cover_picture text not null default '',
  social_links jsonb not null default '{}'::jsonb,
  featured_service_ids text[] not null default '{}',
  min_advance_hours integer not null default 0 check (min_advance_hours >= 0),
  cancellation_policy_hours integer not null default 6 check (cancellation_policy_hours >= 0),
  onboarding_completed boolean not null default false,
  plan text not null default 'freemium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_slug_lower_key on public.profiles (lower(slug)) where slug is not null;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, business_name, slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', ''),
    nullif(lower(new.raw_user_meta_data ->> 'slug'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  legacy_service_id text not null,
  name text not null,
  description text not null default '',
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  buffer_minutes integer not null default 15 check (buffer_minutes >= 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  category text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (professional_id, legacy_service_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  legacy_client_id text not null,
  name text not null,
  phone text not null default '',
  phone_norm text not null default '',
  email text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  last_visit timestamptz,
  created_at timestamptz not null default now(),
  unique (professional_id, legacy_client_id)
);

create index if not exists clients_professional_phone_idx on public.clients (professional_id, phone_norm);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  check (start_time < end_time)
);

create table if not exists public.availability_breaks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  legacy_appointment_id text not null,
  client_name text not null,
  client_phone text not null default '',
  client_email text not null default '',
  notes text not null default '',
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  blocked_until timestamptz not null,
  service_name text not null default '',
  service_price integer not null default 0 check (service_price >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  token text unique,
  manage_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at),
  check (end_at <= blocked_until),
  unique (professional_id, legacy_appointment_id)
);

alter table public.appointments drop constraint if exists appointments_no_overlapping_active_times;
alter table public.appointments add constraint appointments_no_overlapping_active_times
  exclude using gist (
    professional_id with =,
    tstzrange(start_at, blocked_until, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'));

create index if not exists appointments_professional_date_idx on public.appointments (professional_id, appointment_date, start_time);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute procedure public.set_updated_at();

-- Gera horários em uma regra semanal, considerando fuso, pausas e reservas ativas.
create or replace function public.public_available_slots(p_slug text, p_service_id uuid, p_date date)
returns table(start_at timestamptz)
language sql stable security definer set search_path = public as $$
  with professional as (
    select id, timezone from public.profiles where lower(slug) = lower(p_slug) and role = 'professional'
  ), service as (
    select s.duration_minutes, s.buffer_minutes from public.services s
    join professional p on p.id = s.professional_id
    where s.id = p_service_id and s.active
  ), candidates as (
    select ((p_date + r.start_time) at time zone p.timezone) as candidate_start,
           ((p_date + r.end_time) at time zone p.timezone) as rule_end,
           s.duration_minutes, s.buffer_minutes, p.id as professional_id, p.timezone
    from professional p
    join public.availability_rules r on r.professional_id = p.id
    cross join service s
    where r.active and r.weekday = extract(dow from p_date)
  ), slots as (
    select gs as candidate_start, c.rule_end, c.duration_minutes, c.buffer_minutes, c.professional_id, c.timezone
    from candidates c
    cross join lateral generate_series(
      c.candidate_start,
      c.rule_end - make_interval(mins => c.duration_minutes),
      make_interval(mins => c.duration_minutes + c.buffer_minutes)
    ) gs
  )
  select s.candidate_start
  from slots s
  where not exists (
    select 1 from public.availability_breaks b
    where b.professional_id = s.professional_id
      and b.weekday = extract(dow from p_date)
      and tstzrange(s.candidate_start, s.candidate_start + make_interval(mins => s.duration_minutes), '[)')
          && tstzrange((p_date + b.start_time) at time zone s.timezone, (p_date + b.end_time) at time zone s.timezone, '[)')
  )
  and not exists (
    select 1 from public.appointments a
    where a.professional_id = s.professional_id
      and a.status not in ('cancelled', 'no_show')
      and tstzrange(a.start_at, a.blocked_until, '[)')
          && tstzrange(s.candidate_start, s.candidate_start + make_interval(mins => s.duration_minutes + s.buffer_minutes), '[)')
  )
  order by s.candidate_start;
$$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_breaks enable row level security;
alter table public.appointments enable row level security;

-- O backend usa a chave service_role. Sem políticas para anon/authenticated,
-- dados de clientes e agenda nunca ficam expostos diretamente pelo PostgREST.
