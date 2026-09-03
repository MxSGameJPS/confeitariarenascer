-- Otimiza a importação inicial do catálogo GeMaster.
-- A versão anterior fazia consultas de products/mappings para cada linha do CSV e
-- podia atingir o statement_timeout ao importar milhares de produtos.

create index if not exists products_active_normalized_name_idx
  on public.products ((lower(btrim(name))))
  where active;

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
  v_processed integer := 0;
  v_created integer := 0;
  v_matched integer := 0;
  v_existing integer := 0;
  v_pending integer := 0;
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

  -- Evita duas importações globais concorrentes disputando os mesmos códigos.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('renascer:gemaster:catalog-import', 0)
  );

  create temporary table gemaster_import_stage (
    external_code text,
    external_reference text,
    name text,
    normalized_name text,
    type_product text,
    situation integer,
    price numeric(10, 2),
    price_configured boolean,
    mapping_id uuid,
    product_id uuid,
    resolution text
  ) on commit drop;

  insert into pg_temp.gemaster_import_stage (
    external_code,
    external_reference,
    name,
    normalized_name,
    type_product,
    situation,
    price,
    price_configured
  )
  select
    btrim(row_data->>'external_code'),
    nullif(btrim(row_data->>'external_reference'), ''),
    btrim(row_data->>'name'),
    lower(btrim(row_data->>'name')),
    upper(coalesce(nullif(btrim(row_data->>'type_product'), ''), 'N')),
    coalesce(nullif(row_data->>'situation', '')::integer, 1),
    nullif(row_data->>'price', '')::numeric(10, 2),
    coalesce(nullif(row_data->>'price', '')::numeric, 0) > 0
  from jsonb_array_elements(p_rows) as source(row_data);

  if exists (
    select 1
    from pg_temp.gemaster_import_stage
    where external_code is null
       or external_code = ''
       or char_length(external_code) > 64
  ) then
    raise exception 'Código GeMaster inválido';
  end if;

  if exists (
    select 1
    from pg_temp.gemaster_import_stage
    where name is null
       or name = ''
       or char_length(name) > 140
  ) then
    raise exception 'Produto GeMaster inválido';
  end if;

  if exists (
    select 1
    from pg_temp.gemaster_import_stage
    group by external_code
    having count(*) > 1
  ) then
    raise exception 'Código GeMaster duplicado no arquivo';
  end if;

  delete from pg_temp.gemaster_import_stage
  where situation <> 1;

  create unique index gemaster_import_stage_code_idx
    on pg_temp.gemaster_import_stage(external_code);
  create index gemaster_import_stage_name_idx
    on pg_temp.gemaster_import_stage(normalized_name);

  select
    count(*),
    count(*) filter (where not price_configured)
  into v_processed, v_pending
  from pg_temp.gemaster_import_stage;

  -- Resolve de uma vez todos os códigos que já possuem vínculo GeMaster.
  update pg_temp.gemaster_import_stage stage
  set mapping_id = mapping.id,
      product_id = mapping.product_id,
      resolution = 'already_mapped'
  from public.product_external_mappings mapping
  where mapping.provider = 'gemaster'
    and mapping.external_code = stage.external_code
    and mapping.organization_id is null
    and mapping.store_id is null;

  get diagnostics v_existing = row_count;

  -- Reimportação só atualiza o vínculo externo. Preço/imagem/categoria já
  -- administrados no Renascer não são sobrescritos pelo CSV.
  update public.product_external_mappings mapping
  set external_reference = stage.external_reference,
      external_ean = case
        when stage.external_reference ~ '^[0-9]{4,32}$' then stage.external_reference
        else null
      end,
      metadata = coalesce(mapping.metadata, '{}'::jsonb) || jsonb_build_object(
        'type_product', stage.type_product,
        'situation', stage.situation,
        'last_imported_at', now()
      ),
      active = true,
      updated_at = now()
  from pg_temp.gemaster_import_stage stage
  where stage.mapping_id = mapping.id;

  -- Se por algum motivo já existir um produto criado pelo importador, mas sem
  -- mapping, recupera pelo slug determinístico antes de criar outro.
  update pg_temp.gemaster_import_stage stage
  set product_id = product.id,
      resolution = 'matched_existing'
  from public.products product
  where stage.product_id is null
    and product.slug = 'gemaster-' || lower(stage.external_code)
    and not exists (
      select 1
      from public.product_external_mappings mapped
      where mapped.provider = 'gemaster'
        and mapped.product_id = product.id
        and mapped.organization_id is null
        and mapped.store_id is null
    );

  -- Conta quantas linhas NOVAS do próprio CSV possuem cada nome. Nomes repetidos
  -- são ambíguos e nunca reaproveitam um único produto existente.
  create temporary table gemaster_import_name_counts
  on commit drop
  as
  select normalized_name, count(*)::integer as row_count
  from pg_temp.gemaster_import_stage
  where product_id is null
  group by normalized_name;

  create unique index gemaster_import_name_counts_idx
    on pg_temp.gemaster_import_name_counts(normalized_name);

  -- Para nomes únicos no CSV, identifica nomes que também correspondem a exatamente
  -- um produto ativo ainda sem vínculo GeMaster global.
  create temporary table gemaster_import_candidates
  on commit drop
  as
  select
    stage.external_code,
    min(product.id) as product_id
  from pg_temp.gemaster_import_stage stage
  join pg_temp.gemaster_import_name_counts name_count
    on name_count.normalized_name = stage.normalized_name
   and name_count.row_count = 1
  join public.products product
    on lower(btrim(product.name)) = stage.normalized_name
   and product.active
  where stage.product_id is null
    and not exists (
      select 1
      from public.product_external_mappings mapped
      where mapped.provider = 'gemaster'
        and mapped.product_id = product.id
        and mapped.organization_id is null
        and mapped.store_id is null
    )
  group by stage.external_code
  having count(product.id) = 1;

  create unique index gemaster_import_candidates_code_idx
    on pg_temp.gemaster_import_candidates(external_code);

  update pg_temp.gemaster_import_stage stage
  set product_id = candidate.product_id,
      resolution = 'matched_existing'
  from pg_temp.gemaster_import_candidates candidate
  where stage.external_code = candidate.external_code
    and stage.product_id is null;

  -- Cria em lote apenas os produtos que realmente não puderam ser conciliados.
  with inserted as (
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
    )
    select
      null,
      stage.name,
      'gemaster-' || lower(stage.external_code),
      null,
      coalesce(stage.price, 0),
      stage.price_configured,
      case when stage.type_product = 'B' then 'kg' else 'un' end,
      null,
      false,
      true,
      false,
      0,
      0,
      case when stage.type_product = 'B' then 'variable' else 'fixed' end,
      false,
      true
    from pg_temp.gemaster_import_stage stage
    where stage.product_id is null
    returning id, slug
  )
  update pg_temp.gemaster_import_stage stage
  set product_id = inserted.id,
      resolution = 'created'
  from inserted
  where inserted.slug = 'gemaster-' || lower(stage.external_code)
    and stage.product_id is null;

  select count(*)
  into v_created
  from pg_temp.gemaster_import_stage
  where resolution = 'created';

  select count(*)
  into v_matched
  from pg_temp.gemaster_import_stage
  where resolution = 'matched_existing';

  if exists (
    select 1
    from pg_temp.gemaster_import_stage
    where product_id is null
  ) then
    raise exception 'Arquivo GeMaster não pôde ser conciliado completamente';
  end if;

  -- Cria todos os novos mappings em uma única operação.
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
  )
  select
    stage.product_id,
    'gemaster',
    null,
    null,
    stage.external_code,
    case
      when stage.external_reference ~ '^[0-9]{4,32}$' then stage.external_reference
      else null
    end,
    stage.external_reference,
    jsonb_build_object(
      'type_product', stage.type_product,
      'situation', stage.situation,
      'first_imported_at', now(),
      'last_imported_at', now()
    ),
    true
  from pg_temp.gemaster_import_stage stage
  where stage.mapping_id is null;

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
  'Importação set-based do catálogo GeMaster: idempotente por external_code, preserva dados administrados no Renascer e evita timeout em catálogos grandes.';
