begin;

alter table public.barbers
  add column if not exists work_days smallint[] not null default array[1,2,3,4,5,6]::smallint[];
alter table public.profiles
  add column if not exists barber_id uuid references public.barbers(id) on delete set null;
create index if not exists profiles_barber_id_idx on public.profiles(barber_id);

-- Necessário para o painel receber novos agendamentos em tempo real.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

create or replace function public.is_business_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('owner','admin')) $$;
revoke all on function public.is_business_admin() from public;
grant execute on function public.is_business_admin() to authenticated;

create or replace function public.current_barber_id()
returns uuid language sql stable security definer set search_path=public
as $$ select barber_id from profiles where id=auth.uid() and role='barber' $$;
revoke all on function public.current_barber_id() from public;
grant execute on function public.current_barber_id() to authenticated;

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments for select to authenticated
using (
  owner_id=public.current_business_owner_id()
  and (public.is_business_admin() or barber_id=public.current_barber_id())
);
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments for update to authenticated
using (
  owner_id=public.current_business_owner_id()
  and (public.is_business_admin() or barber_id=public.current_barber_id())
)
with check (
  owner_id=public.current_business_owner_id()
  and (public.is_business_admin() or barber_id=public.current_barber_id())
);

-- O barbeiro consulta os dados necessários para sua agenda, mas somente a
-- administração altera cadastros, configurações e demais áreas do negócio.
drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own" on public.services for insert to authenticated
with check (owner_id=public.current_business_owner_id() and public.is_business_admin());
drop policy if exists "services_update_own" on public.services;
create policy "services_update_own" on public.services for update to authenticated
using (owner_id=public.current_business_owner_id() and public.is_business_admin())
with check (owner_id=public.current_business_owner_id() and public.is_business_admin());
drop policy if exists "services_delete_own" on public.services;
create policy "services_delete_own" on public.services for delete to authenticated
using (owner_id=public.current_business_owner_id() and public.is_business_admin());

drop policy if exists "barbers_insert_own" on public.barbers;
create policy "barbers_insert_own" on public.barbers for insert to authenticated
with check (owner_id=public.current_business_owner_id() and public.is_business_admin());
drop policy if exists "barbers_update_own" on public.barbers;
create policy "barbers_update_own" on public.barbers for update to authenticated
using (owner_id=public.current_business_owner_id() and public.is_business_admin())
with check (owner_id=public.current_business_owner_id() and public.is_business_admin());
drop policy if exists "barbers_delete_own" on public.barbers;
create policy "barbers_delete_own" on public.barbers for delete to authenticated
using (owner_id=public.current_business_owner_id() and public.is_business_admin());

create or replace function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table(slot_time time)
language plpgsql security definer set search_path=public
as $$
declare
  v_duration integer; v_start time; v_lunch_start time; v_lunch_end time; v_end time;
  v_work_days smallint[];
begin
  select s.duration_minutes,b.work_start,b.lunch_start,b.lunch_end,b.work_end,b.work_days
    into v_duration,v_start,v_lunch_start,v_lunch_end,v_end,v_work_days
  from services s join barbers b on b.owner_id=s.owner_id
  where s.id=p_service_id and b.id=p_barber_id and s.active and b.active;
  if v_duration is null or v_start is null
     or p_date<timezone('America/Fortaleza',now())::date
     or not (extract(dow from p_date)::smallint=any(v_work_days)) then return; end if;
  return query
  select candidate::time
  from generate_series(p_date+v_start,p_date+v_end-interval '1 minute',interval '15 minutes') candidate
  where candidate+make_interval(mins=>v_duration)<=p_date+v_end
    and (candidate+make_interval(mins=>v_duration)<=p_date+v_lunch_start or candidate>=p_date+v_lunch_end)
    and (p_date>timezone('America/Fortaleza',now())::date or candidate>=timezone('America/Fortaleza',now()))
    and not exists (
      select 1 from appointments a
      where a.barber_id=p_barber_id and a.appointment_date=p_date
        and a.status not in ('cancelled','no_show')
        and candidate<p_date+a.appointment_time+make_interval(mins=>a.duration_minutes)
        and candidate+make_interval(mins=>v_duration)>p_date+a.appointment_time
    )
  order by candidate;
end; $$;

create or replace function public.create_public_appointment(
  p_barber_id uuid, p_service_id uuid, p_date date, p_time time,
  p_client_name text, p_client_phone text, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_owner uuid; v_duration integer; v_price numeric(10,2); v_id uuid;
  v_notification_token uuid; v_confirmation_token uuid; v_work_days smallint[];
  v_start time; v_lunch_start time; v_lunch_end time; v_end time;
  v_candidate timestamp; v_finish timestamp; v_phone text;
begin
  v_phone:=regexp_replace(coalesce(p_client_phone,''),'\D','','g');
  if length(trim(coalesce(p_client_name,''))) not between 2 and 100
     or length(v_phone) not between 10 and 15 or length(coalesce(p_notes,''))>500
     or p_date>timezone('America/Fortaleza',now())::date+365 then
    raise exception 'DADOS_INVALIDOS' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_barber_id::text||p_date::text));
  select b.owner_id,b.work_start,b.lunch_start,b.lunch_end,b.work_end,b.work_days,s.duration_minutes,s.price
    into v_owner,v_start,v_lunch_start,v_lunch_end,v_end,v_work_days,v_duration,v_price
  from barbers b join services s on s.owner_id=b.owner_id
  where b.id=p_barber_id and s.id=p_service_id and b.active and s.active;
  v_candidate:=p_date+p_time; v_finish:=v_candidate+make_interval(mins=>coalesce(v_duration,0));
  if v_owner is null or p_date<timezone('America/Fortaleza',now())::date
     or not (extract(dow from p_date)::smallint=any(v_work_days))
     or v_candidate<timezone('America/Fortaleza',now())
     or extract(minute from p_time)::integer%15<>0 or extract(second from p_time)<>0
     or p_time<v_start or v_finish>p_date+v_end
     or not (v_finish<=p_date+v_lunch_start or p_time>=v_lunch_end)
     or exists(select 1 from appointments a where a.barber_id=p_barber_id and a.appointment_date=p_date
       and a.status not in ('cancelled','no_show')
       and v_candidate<p_date+a.appointment_time+make_interval(mins=>a.duration_minutes)
       and v_finish>p_date+a.appointment_time) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode='P0001';
  end if;
  insert into appointments(owner_id,barber_id,service_id,client_name,client_phone,
    appointment_date,appointment_time,duration_minutes,status,total,notes)
  values(v_owner,p_barber_id,p_service_id,trim(p_client_name),v_phone,p_date,p_time,
    v_duration,'pending',v_price,nullif(trim(coalesce(p_notes,'')),''))
  returning id,notification_token,confirmation_token into v_id,v_notification_token,v_confirmation_token;
  return jsonb_build_object('id',v_id,'notification_token',v_notification_token,'confirmation_token',v_confirmation_token);
end; $$;

create or replace function public.update_appointment_status(p_appointment_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_appointment appointments; v_profile profiles;
begin
  if p_status not in ('confirmed','completed','cancelled','no_show') then
    raise exception 'STATUS_INVALIDO' using errcode='P0001';
  end if;
  select * into v_profile from profiles where id=auth.uid();
  select * into v_appointment from appointments where id=p_appointment_id for update;
  if v_profile.id is null or v_appointment.id is null
     or v_appointment.owner_id<>v_profile.business_owner_id
     or (v_profile.role='barber' and v_appointment.barber_id<>v_profile.barber_id)
     or v_profile.role not in ('owner','admin','barber') then
    raise exception 'SEM_PERMISSAO' using errcode='42501';
  end if;
  if not (
    (v_appointment.status='pending' and p_status in ('confirmed','cancelled'))
    or (v_appointment.status='confirmed' and p_status in ('completed','cancelled','no_show'))
  ) then raise exception 'TRANSICAO_INVALIDA' using errcode='P0001'; end if;
  update appointments set status=p_status,updated_at=now() where id=p_appointment_id;
  return jsonb_build_object('id',p_appointment_id,'status',p_status);
end; $$;
revoke all on function public.update_appointment_status(uuid,text) from public;
grant execute on function public.update_appointment_status(uuid,text) to authenticated;

commit;
