begin;

-- A página pública recebe somente os campos necessários; o CRUD permanece
-- protegido pelas políticas autenticadas do mesmo negócio.
create or replace function public.get_public_gallery()
returns table(id uuid,title text,image_url text)
language sql stable security definer set search_path=public
as $$
  select g.id,g.title,g.image_url
  from public.gallery g
  where g.active=true
  order by g.created_at desc;
$$;
revoke all on function public.get_public_gallery() from public;
grant execute on function public.get_public_gallery() to anon,authenticated;

commit;
