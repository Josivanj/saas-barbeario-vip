begin;

with business_owner as (
  select id
  from public.profiles
  where role = 'owner'
  order by created_at
  limit 1
),
haircuts(position, title, file_name) as (
  values
    (1,  'Degradê alto',     'degrade-alto.webp'),
    (2,  'Degradê médio',    'degrade-medio.webp'),
    (3,  'Degradê baixo',    'degrade-baixo.webp'),
    (4,  'Texturizado',      'texturizado.webp'),
    (5,  'Moicano',          'moicano.webp'),
    (6,  'Risco na navalha', 'risco-na-navalha.webp'),
    (7,  'Platinado',        'platinado.webp'),
    (8,  'Social',           'social.webp'),
    (9,  'Crespo',           'crespo.webp'),
    (10, 'Degradê em V',     'degrade-em-v.webp'),
    (11, 'Risco lateral',    'risco-lateral.webp'),
    (12, 'Militar',          'militar.webp'),
    (13, 'Ondulado',         'ondulado.webp'),
    (14, 'Topete',           'topete.webp'),
    (15, 'Espinhado',        'espinhado.webp'),
    (16, 'Caesar',           'caesar.webp'),
    (17, 'Franja',           'franja.webp'),
    (18, 'Zero com risco',   'zero-com-risco.webp')
)
insert into public.gallery (owner_id, title, image_url, active, created_at)
select
  business_owner.id,
  haircuts.title,
  'https://barbeario-vipcom.vercel.app/assets/gallery/' || haircuts.file_name,
  true,
  now() - ((haircuts.position - 1) * interval '1 second')
from business_owner
cross join haircuts
where not exists (
  select 1
  from public.gallery existing
  where existing.owner_id = business_owner.id
    and existing.image_url = 'https://barbeario-vipcom.vercel.app/assets/gallery/' || haircuts.file_name
);

commit;
