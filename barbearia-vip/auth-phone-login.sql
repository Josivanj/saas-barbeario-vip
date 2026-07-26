begin;

-- Dados de contato usados somente dentro do painel administrativo.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

update public.profiles as profile
set email = users.email,
    phone = coalesce(profile.phone, users.phone)
from auth.users as users
where profile.id = users.id;

commit;
