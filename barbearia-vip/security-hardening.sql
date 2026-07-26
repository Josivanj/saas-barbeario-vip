begin;

-- Impede alteração de role/business_owner_id pelo próprio usuário.
drop policy if exists "profiles_update_own" on public.profiles;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- O público deixa de consultar a tabela completa de barbeiros.
drop policy if exists "barbers_public_select_active" on public.barbers;
revoke select on public.barbers from anon;

create or replace function public.get_public_barbers()
returns table(id uuid, name text, specialty text, phone text, instagram text, image_url text)
language sql stable security definer set search_path=public
as $$
  select b.id,b.name,b.specialty,b.phone,b.instagram,b.image_url
  from public.barbers b
  where b.active=true
  order by b.name;
$$;
revoke all on function public.get_public_barbers() from public;
grant execute on function public.get_public_barbers() to anon,authenticated;

alter table public.appointments
  add column if not exists notification_token uuid not null default gen_random_uuid(),
  add column if not exists notification_claimed_at timestamptz;
create unique index if not exists appointments_notification_token_idx
  on public.appointments(notification_token);

-- Substitui retorno antigo por ID + token secreto de envio.
drop function if exists public.create_public_appointment(uuid,uuid,date,time,text,text,text);
create function public.create_public_appointment(
  p_barber_id uuid, p_service_id uuid, p_date date, p_time time,
  p_client_name text, p_client_phone text, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_owner uuid; v_duration integer; v_price numeric(10,2); v_id uuid;
  v_notification_token uuid; v_confirmation_token uuid;
  v_start time; v_lunch_start time; v_lunch_end time; v_end time;
  v_candidate timestamp; v_finish timestamp; v_phone text;
begin
  v_phone:=regexp_replace(coalesce(p_client_phone,''),'\D','','g');
  if length(trim(coalesce(p_client_name,''))) not between 2 and 100
     or length(v_phone) not between 10 and 15
     or length(coalesce(p_notes,''))>500
     or p_date>timezone('America/Fortaleza',now())::date+365 then
    raise exception 'DADOS_INVALIDOS' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_barber_id::text||p_date::text));
  select b.owner_id,b.work_start,b.lunch_start,b.lunch_end,b.work_end,s.duration_minutes,s.price
    into v_owner,v_start,v_lunch_start,v_lunch_end,v_end,v_duration,v_price
  from barbers b join services s on s.owner_id=b.owner_id
  where b.id=p_barber_id and s.id=p_service_id and b.active and s.active;
  v_candidate:=p_date+p_time; v_finish:=v_candidate+make_interval(mins=>coalesce(v_duration,0));
  if v_owner is null or p_date<timezone('America/Fortaleza',now())::date
     or v_candidate<timezone('America/Fortaleza',now())
     or extract(minute from p_time)::integer % 15<>0 or extract(second from p_time)<>0
     or p_time<v_start or v_finish>p_date+v_end
     or not (v_finish<=p_date+v_lunch_start or p_time>=v_lunch_end)
     or exists(select 1 from appointments a where a.barber_id=p_barber_id and a.appointment_date=p_date
       and a.status not in ('cancelled','no_show')
       and v_candidate<p_date+a.appointment_time+make_interval(mins=>a.duration_minutes)
       and v_finish>p_date+a.appointment_time) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode='P0001';
  end if;
  insert into appointments(
    owner_id,barber_id,service_id,client_name,client_phone,appointment_date,
    appointment_time,duration_minutes,status,total,notes
  ) values(
    v_owner,p_barber_id,p_service_id,trim(p_client_name),v_phone,p_date,p_time,
    v_duration,'pending',v_price,nullif(trim(coalesce(p_notes,'')),'')
  ) returning id,notification_token,confirmation_token
    into v_id,v_notification_token,v_confirmation_token;
  return jsonb_build_object(
    'id',v_id,
    'notification_token',v_notification_token,
    'confirmation_token',v_confirmation_token
  );
end; $$;
revoke all on function public.create_public_appointment(uuid,uuid,date,time,text,text,text) from public;
grant execute on function public.create_public_appointment(uuid,uuid,date,time,text,text,text) to anon,authenticated;

-- Entrega dados pessoais uma única vez e somente com dois tokens aleatórios.
drop function if exists public.get_appointment_notification(uuid);
create or replace function public.claim_appointment_notification(
  p_appointment_id uuid,p_notification_token uuid
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_result jsonb;
begin
  update appointments
  set notification_claimed_at=now()
  where id=p_appointment_id and notification_token=p_notification_token
    and notification_claimed_at is null and created_at>now()-interval '1 day';
  if not found then return null; end if;
  select jsonb_build_object(
    'id',a.id,'client_name',a.client_name,'client_phone',a.client_phone,
    'service',s.name,'barber',b.name,'barber_phone',b.phone,
    'appointment_date',a.appointment_date,'appointment_time',to_char(a.appointment_time,'HH24:MI'),
    'notes',a.notes,'confirmation_token',a.confirmation_token
  ) into v_result
  from appointments a join services s on s.id=a.service_id join barbers b on b.id=a.barber_id
  where a.id=p_appointment_id;
  return v_result;
end; $$;
revoke all on function public.claim_appointment_notification(uuid,uuid) from public;
grant execute on function public.claim_appointment_notification(uuid,uuid) to anon,authenticated;

create or replace function public.get_confirmation_preview(p_token uuid)
returns jsonb language sql stable security definer set search_path=public
as $$
  select jsonb_build_object(
    'client_name',a.client_name,'service',s.name,'barber',b.name,
    'appointment_date',a.appointment_date,'appointment_time',to_char(a.appointment_time,'HH24:MI'),
    'status',a.status
  )
  from appointments a join services s on s.id=a.service_id join barbers b on b.id=a.barber_id
  where a.confirmation_token=p_token and a.status in ('pending','confirmed','cancelled');
$$;
revoke all on function public.get_confirmation_preview(uuid) from public;
grant execute on function public.get_confirmation_preview(uuid) to anon,authenticated;

create or replace function public.confirm_public_appointment(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_result jsonb;
begin
  update appointments set status='confirmed',updated_at=now()
  where confirmation_token=p_token and status='pending'
    and appointment_date>=timezone('America/Fortaleza',now())::date;
  select jsonb_build_object('id',id,'status',status) into v_result
  from appointments where confirmation_token=p_token and status='confirmed';
  if v_result is null then raise exception 'TOKEN_INVALIDO' using errcode='P0001'; end if;
  return v_result;
end; $$;
revoke all on function public.confirm_public_appointment(uuid) from public;
grant execute on function public.confirm_public_appointment(uuid) to anon,authenticated;

-- O barbeiro pode recusar uma solicitação pendente; cancelada, ela deixa de
-- bloquear o intervalo e os horários voltam a ser calculados normalmente.
create or replace function public.decline_public_appointment(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_result jsonb;
begin
  update appointments set status='cancelled',updated_at=now()
  where confirmation_token=p_token and status='pending'
    and appointment_date>=timezone('America/Fortaleza',now())::date;
  select jsonb_build_object('id',id,'status',status) into v_result
  from appointments where confirmation_token=p_token and status='cancelled';
  if v_result is null then raise exception 'TOKEN_INVALIDO' using errcode='P0001'; end if;
  return v_result;
end; $$;
revoke all on function public.decline_public_appointment(uuid) from public;
grant execute on function public.decline_public_appointment(uuid) to anon,authenticated;

commit;
