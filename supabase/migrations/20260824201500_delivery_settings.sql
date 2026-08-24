alter table public.store_settings
  add column if not exists business_hours jsonb not null default '[]'::jsonb,
  add column if not exists delivery_areas jsonb not null default '[]'::jsonb,
  add column if not exists store_timezone text not null default 'America/Sao_Paulo';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_business_hours_array_check'
      and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings
      add constraint store_settings_business_hours_array_check
      check (jsonb_typeof(business_hours) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_delivery_areas_array_check'
      and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings
      add constraint store_settings_delivery_areas_array_check
      check (jsonb_typeof(delivery_areas) = 'array' and jsonb_array_length(delivery_areas) <= 200);
  end if;
end
$$;

comment on column public.store_settings.business_hours is
  'Horarios semanais do delivery. Array vazio significa que ainda nao foram configurados.';
comment on column public.store_settings.delivery_areas is
  'Cidades e bairros ou pontos atendidos pelo delivery.';

