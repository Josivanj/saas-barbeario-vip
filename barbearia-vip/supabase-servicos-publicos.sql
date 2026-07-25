-- BARBEARIA VIP — liberar leitura pública dos serviços ativos
-- Execute no Supabase: SQL Editor > New query > Run

alter table public.services enable row level security;

drop policy if exists "services_public_select_active" on public.services;
create policy "services_public_select_active"
on public.services
for select
to anon, authenticated
using (active = true or (select auth.uid()) = owner_id);

grant usage on schema public to anon;
grant select on public.services to anon;

-- A agenda pública também precisa listar os barbeiros ativos.
alter table public.barbers enable row level security;
drop policy if exists "barbers_public_select_active" on public.barbers;
create policy "barbers_public_select_active" on public.barbers for select to anon, authenticated
using (active = true or (select auth.uid()) = owner_id);
grant select on public.barbers to anon;
