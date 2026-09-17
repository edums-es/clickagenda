-- Photo catalog, retry-safe bookings and durable professional notifications.
begin;
alter table public.services add column if not exists image_url text not null default '';
-- Restored projects may predate the category field used by the API.
alter table public.services add column if not exists category text not null default '';
alter table public.appointments add column if not exists booking_request_id uuid;
create unique index if not exists appointments_booking_request_key
  on public.appointments(professional_id, booking_request_id)
  where booking_request_id is not null;

create table if not exists public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null,
  client_name text not null,
  service_name text not null,
  appointment_date date not null,
  start_time time not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.booking_notifications enable row level security;
create index if not exists booking_notifications_owner_recent
  on public.booking_notifications(professional_id, created_at desc);

create or replace function public.notify_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' or new.status is distinct from old.status then
    insert into public.booking_notifications
      (professional_id, appointment_id, kind, client_name, service_name, appointment_date, start_time)
    values (new.professional_id, new.id,
      case when TG_OP = 'INSERT' then 'booking_created' else 'booking_' || new.status end,
      new.client_name, new.service_name, new.appointment_date, new.start_time);
  end if;
  return new;
end;
$$;
-- Replacing this trigger is safe to rerun and does not touch booking data.
create or replace trigger appointments_notify_change
  after insert or update of status on public.appointments
  for each row execute function public.notify_booking_change();
commit;
