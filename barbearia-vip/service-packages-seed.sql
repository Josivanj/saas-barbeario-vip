begin;

with business_owner as (
  select id
  from public.profiles
  where role = 'owner'
  order by created_at
  limit 1
),
packages(name, description, price, duration_minutes, image_url) as (
  values
    (
      'Só corte',
      'Escolha um dos modelos disponíveis e personalize seu visual.',
      35.00,
      45,
      'https://barbeario-vipcom.vercel.app/assets/gallery/degrade-alto.webp'
    ),
    (
      'Corte + barba',
      'Corte personalizado com modelagem e acabamento completo da barba.',
      55.00,
      75,
      'https://barbeario-vipcom.vercel.app/assets/gallery/social.webp'
    ),
    (
      'Corte + barba + sobrancelha',
      'Experiência completa com corte, barba e acabamento da sobrancelha.',
      65.00,
      90,
      'https://barbeario-vipcom.vercel.app/assets/gallery/texturizado.webp'
    )
)
insert into public.services (
  owner_id, name, description, price, duration_minutes, image_url, active
)
select
  business_owner.id,
  packages.name,
  packages.description,
  packages.price,
  packages.duration_minutes,
  packages.image_url,
  true
from business_owner
cross join packages
where not exists (
  select 1
  from public.services existing
  where existing.owner_id = business_owner.id
    and lower(existing.name) = lower(packages.name)
);

-- Remove apenas os dados demonstrativos antigos da tela pública.
update public.services
set active = false
where lower(trim(name)) in ('teste', 'test');

commit;
