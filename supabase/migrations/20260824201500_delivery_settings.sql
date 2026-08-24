alter table public.store_settings
  add column business_hours jsonb not null default '[]'::jsonb,
  add column delivery_areas jsonb not null default '[]'::jsonb,
  add column store_timezone text not null default 'America/Sao_Paulo';

alter table public.store_settings
  add constraint store_settings_business_hours_array_check
    check (jsonb_typeof(business_hours) = 'array'),
  add constraint store_settings_delivery_areas_array_check
    check (jsonb_typeof(delivery_areas) = 'array' and jsonb_array_length(delivery_areas) <= 200);

comment on column public.store_settings.business_hours is
  'Horarios semanais do delivery. Array vazio significa que ainda nao foram configurados.';
comment on column public.store_settings.delivery_areas is
  'Cidades e bairros ou pontos atendidos pelo delivery.';

