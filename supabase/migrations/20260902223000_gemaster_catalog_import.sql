-- Catálogo inicial GeMaster -> Renascer.
-- Mantém o UUID do Renascer como identidade interna e preserva os códigos externos.

alter table public.products
  add column if not exists price_configured boolean not null default true;

alter table public.product_external_mappings
  add column if not exists external_reference text;

alter table public.products
  drop constraint if exists products_delivery_price_configured_check;

alter table public.products
  add constraint products_delivery_price_configured_check
    check (not available_delivery or price_configured);

create index if not exists products_price_configured_idx
  on public.products(price_configured, active, available_internal);

create unique index if not exists product_external_mappings_external_code_scope_unique_idx
  on public.product_external_mappings(
    provider,
    external_code,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

comment on column public.products.price_configured is
  'Indica se o preço foi confirmado no Renascer. Produtos pendentes não podem aparecer no delivery e são bloqueados nas consultas operacionais.';

comment on column public.product_external_mappings.external_reference is
  'Referência original do sistema externo preservada como texto, inclusive zeros à esquerda e caracteres não numéricos.';

create or replace function public.import_gemaster_products(
  p_rows jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_external_code text;
  v_external_reference text;
  v_name text;
  v_type_product text;
  v_situation integer;
  v_price numeric(10, 2);
  v_price_configured boolean;
  v_product_id uuid;
  v_mapping_id uuid;
  v_match_count integer;
  v_created integer := 0;
  v_matched integer := 0;
  v_existing integer := 0;
  v_pending integer := 0;
  v_processed integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Arquivo GeMaster inválido';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'Arquivo GeMaster sem produtos';
  end if;

  if jsonb_array_length(p_rows) > 10000 then
    raise exception 'Arquivo GeMaster excede o limite de 10000 produtos';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_external_code := trim(v_row->>'external_code');
    v_external_reference := nullif(trim(v_row->>'external_reference'), '');
    v_name := trim(v_row->>'name');
    v_type_product := upper(coalesce(nullif(trim(v_row->>'type_product'), ''), 'N'));
    v_situation := coalesce((v_row->>'situation')::integer, 1);
    v_price := nullif(v_row->>'price', '')::numeric;
    v_price_configured := v_price is not null and v_price > 0;

    if v_external_code is null or v_external_code = '' or char_length(v_external_code) > 64 then
      raise exception 'Código GeMaster inválido';
    end if;

    if v_name is null or v_name = '' or char_length(v_name) > 140 then
      raise exception 'Produto GeMaster inválido: %', v_external_code;
    end if;

    if v_situation <> 1 then
      continue;
    end if;

    v_processed := v_processed + 1;
    if not v_price_configured then
      v_pending := v_pending + 1;
    end if;

    v_product_id := null;
    v_mapping_id := null;

    select m.id, m.product_id
      into v_mapping_id, v_product_id
    from public.product_external_mappings m
    where m.provider = 'gemaster'
      and m.external_code = v_external_code
      and m.organization_id is null
      and m.store_id is null
    limit 1;

    if v_mapping_id is not null then
      v_existing := v_existing + 1;

      update public.product_external_mappings
      set external_reference = v_external_reference,
          external_ean = case
            when v_external_reference ~ '^[0-9]{4,32}$' then v_external_reference
            else null
          end,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'type_product', v_type_product,
            'situation', v_situation,
            'last_imported_at', now()
          ),
          active = true,
          updated_at = now()
      where id = v_mapping_id;

      continue;
    end if;

    select count(*)
      into v_match_count
    from public.products p
    where lower(trim(p.name)) = lower(v_name);

    if v_match_count = 1 then
      select p.id
        into v_product_id
      from public.products p
      where lower(trim(p.name)) = lower(v_name)
      limit 1;

      v_matched := v_matched + 1;
    else
      insert into public.products (
        category_id,
        name,
        slug,
        description,
        price,
        price_configured,
        unit,
        image_path,
        featured,
        active,
        stock_control,
        stock_quantity,
        sort_order,
        pricing_mode,
        available_delivery,
        available_internal
      ) values (
        null,
        v_name,
        'gemaster-' || lower(v_external_code),
        null,
        coalesce(v_price, 0),
        v_price_configured,
        case when v_type_product = 'B' then 'kg' else 'un' end,
        null,
        false,
        true,
        false,
        0,
        0,
        case when v_type_product = 'B' then 'variable' else 'fixed' end,
        false,
        true
      )
      returning id into v_product_id;

      v_created := v_created + 1;
    end if;

    insert into public.product_external_mappings (
      product_id,
      provider,
      organization_id,
      store_id,
      external_code,
      external_ean,
      external_reference,
      metadata,
      active
    ) values (
      v_product_id,
      'gemaster',
      null,
      null,
      v_external_code,
      case
        when v_external_reference ~ '^[0-9]{4,32}$' then v_external_reference
        else null
      end,
      v_external_reference,
      jsonb_build_object(
        'type_product', v_type_product,
        'situation', v_situation,
        'first_imported_at', now(),
        'last_imported_at', now()
      ),
      true
    );
  end loop;

  insert into public.audit_logs (
    actor_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_actor_id,
    'admin',
    'gemaster.catalog_imported',
    'catalog_import',
    'gemaster',
    jsonb_build_object(
      'processed', v_processed,
      'created', v_created,
      'matched_existing', v_matched,
      'already_mapped', v_existing,
      'price_pending', v_pending
    )
  );

  return jsonb_build_object(
    'processed', v_processed,
    'created', v_created,
    'matched_existing', v_matched,
    'already_mapped', v_existing,
    'price_pending', v_pending
  );
end;
$$;

revoke execute on function public.import_gemaster_products(jsonb, uuid)
  from public, anon, authenticated;

grant execute on function public.import_gemaster_products(jsonb, uuid)
  to service_role;

comment on function public.import_gemaster_products(jsonb, uuid) is
  'Importa catálogo GeMaster de forma idempotente usando external_code como identidade externa; preserva preços já administrados no Renascer em reimportações.';
