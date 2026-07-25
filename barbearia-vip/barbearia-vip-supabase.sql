-- =========================================================
-- BARBEARIA VIP — BANCO DE DADOS SUPABASE
-- Execute no Supabase: SQL Editor > New query > Run
-- =========================================================

create extension if not exists pgcrypto;

-- 1. PERFIL DO USUÁRIO
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Barbearia VIP',
  full_name text,
  phone text,
  role text not null default 'owner' check (role in ('owner', 'admin', 'barber')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. SERVIÇOS
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. BARBEIROS
create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  specialty text,
  phone text,
  email text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. CLIENTES
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, phone)
);

-- 5. AGENDAMENTOS
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  client_name text not null,
  client_phone text not null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded')),
  total numeric(10,2) not null default 0 check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barber_id, appointment_date, appointment_time)
);

-- 6. GALERIA
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  image_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 7. FINANCEIRO
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ÍNDICES
create index if not exists services_owner_id_idx on public.services(owner_id);
create index if not exists barbers_owner_id_idx on public.barbers(owner_id);
create index if not exists clients_owner_id_idx on public.clients(owner_id);
create index if not exists appointments_owner_date_idx
  on public.appointments(owner_id, appointment_date);
create index if not exists gallery_owner_id_idx on public.gallery(owner_id);
create index if not exists transactions_owner_date_idx
  on public.transactions(owner_id, transaction_date);

-- FUNÇÃO PARA updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists barbers_set_updated_at on public.barbers;
create trigger barbers_set_updated_at
before update on public.barbers
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

-- CRIA PERFIL AUTOMATICAMENTE APÓS CADASTRO
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- CRIA PERFIL PARA USUÁRIOS QUE JÁ EXISTEM
insert into public.profiles (id, full_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- =========================================================
-- SEGURANÇA RLS
-- Cada usuário autenticado acessa apenas os próprios dados.
-- =========================================================

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.gallery enable row level security;
alter table public.transactions enable row level security;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- SERVIÇOS
drop policy if exists "services_select_own" on public.services;
create policy "services_select_own"
on public.services for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own"
on public.services for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "services_update_own" on public.services;
create policy "services_update_own"
on public.services for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "services_delete_own" on public.services;
create policy "services_delete_own"
on public.services for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- BARBEIROS
drop policy if exists "barbers_select_own" on public.barbers;
create policy "barbers_select_own"
on public.barbers for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "barbers_insert_own" on public.barbers;
create policy "barbers_insert_own"
on public.barbers for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "barbers_update_own" on public.barbers;
create policy "barbers_update_own"
on public.barbers for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "barbers_delete_own" on public.barbers;
create policy "barbers_delete_own"
on public.barbers for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- CLIENTES
drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
on public.clients for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own"
on public.clients for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own"
on public.clients for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own"
on public.clients for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- AGENDAMENTOS
drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own"
on public.appointments for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own"
on public.appointments for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own"
on public.appointments for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own"
on public.appointments for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- GALERIA
drop policy if exists "gallery_select_own" on public.gallery;
create policy "gallery_select_own"
on public.gallery for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "gallery_insert_own" on public.gallery;
create policy "gallery_insert_own"
on public.gallery for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "gallery_update_own" on public.gallery;
create policy "gallery_update_own"
on public.gallery for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "gallery_delete_own" on public.gallery;
create policy "gallery_delete_own"
on public.gallery for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- FINANCEIRO
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
on public.transactions for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
on public.transactions for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
on public.transactions for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Permissões básicas para usuários autenticados
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.services,
  public.barbers,
  public.clients,
  public.appointments,
  public.gallery,
  public.transactions
to authenticated;

-- =========================================================
-- AGENDA PROFISSIONAL (execute também em bancos já existentes)
-- =========================================================
alter table public.barbers add column if not exists work_start time not null default '08:00';
alter table public.barbers add column if not exists instagram text;
alter table public.barbers add column if not exists lunch_start time not null default '12:00';
alter table public.barbers add column if not exists lunch_end time not null default '13:00';
alter table public.barbers add column if not exists work_end time not null default '18:00';

alter table public.appointments add column if not exists duration_minutes integer not null default 30;
update public.appointments a set duration_minutes=s.duration_minutes
from public.services s where s.id=a.service_id and a.duration_minutes=30;
do $$ begin
  alter table public.appointments add constraint appointments_duration_positive check (duration_minutes > 0);
exception when duplicate_object then null;
end $$;
create index if not exists appointments_barber_date_idx on public.appointments(barber_id, appointment_date);

-- Barbeiros ativos podem ser exibidos na página pública. Dados de agenda e telefone não são necessários na UI.
drop policy if exists "barbers_public_select_active" on public.barbers;
create policy "barbers_public_select_active" on public.barbers for select to anon, authenticated
using (active = true or (select auth.uid()) = owner_id);
grant select on public.barbers to anon;

-- Retorna inícios em intervalos de 15 minutos. Um serviço deve caber inteiro
-- no turno da manhã ou da tarde e não pode sobrepor reservas ativas.
create or replace function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table(slot_time time)
language plpgsql security definer set search_path = public
as $$
declare
  v_duration integer;
  v_start time;
  v_lunch_start time;
  v_lunch_end time;
  v_end time;
begin
  select s.duration_minutes into v_duration from services s
  join barbers b on b.owner_id=s.owner_id
  where s.id=p_service_id and b.id=p_barber_id and s.active and b.active;
  select b.work_start,b.lunch_start,b.lunch_end,b.work_end
    into v_start,v_lunch_start,v_lunch_end,v_end from barbers b where b.id=p_barber_id and b.active;
  if v_duration is null or v_start is null or p_date < timezone('America/Fortaleza',now())::date then return; end if;

  return query
  select candidate::time
  from generate_series(p_date+v_start, p_date+v_end-interval '1 minute', interval '15 minutes') candidate
  where candidate + make_interval(mins=>v_duration) <= p_date+v_end
    and (candidate + make_interval(mins=>v_duration) <= p_date+v_lunch_start or candidate >= p_date+v_lunch_end)
    and (p_date > timezone('America/Fortaleza',now())::date or candidate >= timezone('America/Fortaleza',now()))
    and not exists (
      select 1 from appointments a
      where a.barber_id=p_barber_id and a.appointment_date=p_date
        and a.status not in ('cancelled','no_show')
        and candidate < p_date+a.appointment_time+make_interval(mins=>a.duration_minutes)
        and candidate+make_interval(mins=>v_duration) > p_date+a.appointment_time
    )
  order by candidate;
end; $$;

-- Criação atômica: o advisory lock serializa reservas do mesmo barbeiro/data.
create or replace function public.create_public_appointment(
  p_barber_id uuid, p_service_id uuid, p_date date, p_time time,
  p_client_name text, p_client_phone text, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid; v_duration integer; v_price numeric(10,2); v_id uuid;
  v_start time; v_lunch_start time; v_lunch_end time; v_end time;
  v_candidate timestamp; v_finish timestamp;
begin
  perform pg_advisory_xact_lock(hashtext(p_barber_id::text||p_date::text));
  select b.owner_id,b.work_start,b.lunch_start,b.lunch_end,b.work_end,s.duration_minutes,s.price
    into v_owner,v_start,v_lunch_start,v_lunch_end,v_end,v_duration,v_price
  from barbers b join services s on s.owner_id=b.owner_id
  where b.id=p_barber_id and s.id=p_service_id and b.active and s.active;
  v_candidate:=p_date+p_time; v_finish:=v_candidate+make_interval(mins=>coalesce(v_duration,0));
  if v_owner is null or p_date<timezone('America/Fortaleza',now())::date or v_candidate<timezone('America/Fortaleza',now())
     or extract(minute from p_time)::integer % 15 <> 0 or extract(second from p_time) <> 0
     or p_time<v_start or v_finish>p_date+v_end
     or not (v_finish<=p_date+v_lunch_start or p_time>=v_lunch_end)
     or exists(select 1 from appointments a where a.barber_id=p_barber_id and a.appointment_date=p_date
       and a.status not in ('cancelled','no_show')
       and v_candidate<p_date+a.appointment_time+make_interval(mins=>a.duration_minutes)
       and v_finish>p_date+a.appointment_time) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode='P0001';
  end if;
  insert into appointments(owner_id,barber_id,service_id,client_name,client_phone,appointment_date,appointment_time,duration_minutes,status,total,notes)
  values(v_owner,p_barber_id,p_service_id,trim(p_client_name),trim(p_client_phone),p_date,p_time,v_duration,'confirmed',v_price,p_notes)
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.get_available_slots(uuid,uuid,date) from public;
revoke all on function public.create_public_appointment(uuid,uuid,date,time,text,text,text) from public;
grant execute on function public.get_available_slots(uuid,uuid,date) to anon,authenticated;
grant execute on function public.create_public_appointment(uuid,uuid,date,time,text,text,text) to anon,authenticated;

-- =========================================================
-- ADMINISTRADORES DO MESMO NEGÓCIO
-- =========================================================
alter table public.profiles add column if not exists business_owner_id uuid references public.profiles(id) on delete restrict;
update public.profiles set business_owner_id=id where business_owner_id is null;
alter table public.profiles alter column business_owner_id set not null;
create index if not exists profiles_business_owner_idx on public.profiles(business_owner_id);

create or replace function public.current_business_owner_id()
returns uuid language sql stable security definer set search_path=public
as $$ select coalesce((select business_owner_id from profiles where id=auth.uid()),auth.uid()) $$;
revoke all on function public.current_business_owner_id() from public;
grant execute on function public.current_business_owner_id() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.profiles(id,business_owner_id,full_name)
  values(new.id,new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end; $$;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_business" on public.profiles;
create policy "profiles_select_business" on public.profiles for select to authenticated
using (business_owner_id=public.current_business_owner_id());

-- Substitui as políticas individuais por acesso compartilhado do mesmo negócio.
drop policy if exists "services_select_own" on public.services;
create policy "services_select_own" on public.services for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own" on public.services for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "services_update_own" on public.services;
create policy "services_update_own" on public.services for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "services_delete_own" on public.services;
create policy "services_delete_own" on public.services for delete to authenticated using (owner_id=public.current_business_owner_id());

drop policy if exists "barbers_select_own" on public.barbers;
create policy "barbers_select_own" on public.barbers for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "barbers_insert_own" on public.barbers;
create policy "barbers_insert_own" on public.barbers for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "barbers_update_own" on public.barbers;
create policy "barbers_update_own" on public.barbers for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "barbers_delete_own" on public.barbers;
create policy "barbers_delete_own" on public.barbers for delete to authenticated using (owner_id=public.current_business_owner_id());

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own" on public.clients for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own" on public.clients for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own" on public.clients for delete to authenticated using (owner_id=public.current_business_owner_id());

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own" on public.appointments for delete to authenticated using (owner_id=public.current_business_owner_id());

drop policy if exists "gallery_select_own" on public.gallery;
create policy "gallery_select_own" on public.gallery for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "gallery_insert_own" on public.gallery;
create policy "gallery_insert_own" on public.gallery for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "gallery_update_own" on public.gallery;
create policy "gallery_update_own" on public.gallery for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "gallery_delete_own" on public.gallery;
create policy "gallery_delete_own" on public.gallery for delete to authenticated using (owner_id=public.current_business_owner_id());

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select to authenticated using (owner_id=public.current_business_owner_id());
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions for insert to authenticated with check (owner_id=public.current_business_owner_id());
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions for update to authenticated using (owner_id=public.current_business_owner_id()) with check (owner_id=public.current_business_owner_id());
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions for delete to authenticated using (owner_id=public.current_business_owner_id());
