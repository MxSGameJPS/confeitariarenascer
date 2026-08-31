-- Integração segura Renascer Bridge -> GeMaster.
-- O Bridge apenas prepara/injeta itens. Pagamento e fiscal continuam sob autoridade do GeMaster.

create table if not exists public.bridge_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  organization_id uuid,
  store_id uuid,
  active boolean not null default true,
  created_by_admin_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bridge_devices_scope_check check (store_id is null or organization_id is not null)
);

create index if not exists bridge_devices_active_idx
  on public.bridge_devices(active, name);
create index if not exists bridge_devices_scope_idx
  on public.bridge_devices(organization_id, store_id, active);

create table if not exists public.product_external_mappings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  provider text not null default 'gemaster' check (provider ~ '^[a-z0-9_-]{2,40}$'),
  organization_id uuid,
  store_id uuid,
  external_code text not null check (char_length(trim(external_code)) between 1 and 64),
  external_ean text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_external_mappings_scope_check check (store_id is null or organization_id is not null),
  constraint product_external_mappings_ean_check check (external_ean is null or external_ean ~ '^[0-9]{4,32}$')
);

create unique index if not exists product_external_mappings_scope_unique_idx
  on public.product_external_mappings(
    provider,
    product_id,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists product_external_mappings_lookup_idx
  on public.product_external_mappings(provider, product_id, organization_id, store_id, active);

create table if not exists public.bridge_dispatches (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.bridge_devices(id) on delete restrict,
  operation_key uuid not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  reference_code text not null check (char_length(reference_code) between 2 and 32),
  reference_type text not null check (reference_type in ('comanda', 'delivery')),
  status text not null default 'prepared' check (status in ('prepared', 'injected', 'failed')),
  response_payload jsonb not null,
  error_message text,
  prepared_at timestamptz not null default now(),
  injected_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id, operation_key)
);

create index if not exists bridge_dispatches_order_idx
  on public.bridge_dispatches(order_id, created_at desc);
create index if not exists bridge_dispatches_status_idx
  on public.bridge_dispatches(status, created_at desc);

alter table public.bridge_devices enable row level security;
alter table public.product_external_mappings enable row level security;
alter table public.bridge_dispatches enable row level security;

revoke all on table public.bridge_devices from public, anon, authenticated;
revoke all on table public.product_external_mappings from public, anon, authenticated;
revoke all on table public.bridge_dispatches from public, anon, authenticated;
grant all on table public.bridge_devices to service_role;
grant all on table public.product_external_mappings to service_role;
grant all on table public.bridge_dispatches to service_role;

drop trigger if exists bridge_devices_set_updated_at on public.bridge_devices;
create trigger bridge_devices_set_updated_at
before update on public.bridge_devices
for each row execute function public.set_updated_at();

drop trigger if exists product_external_mappings_set_updated_at on public.product_external_mappings;
create trigger product_external_mappings_set_updated_at
before update on public.product_external_mappings
for each row execute function public.set_updated_at();

drop trigger if exists bridge_dispatches_set_updated_at on public.bridge_dispatches;
create trigger bridge_dispatches_set_updated_at
before update on public.bridge_dispatches
for each row execute function public.set_updated_at();

create or replace function public.prepare_gemaster_bridge_dispatch(
  p_reference_code text,
  p_operation_key uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_reference_code));
  v_device public.bridge_devices;
  v_order public.orders;
  v_existing public.bridge_dispatches;
  v_dispatch_id uuid := gen_random_uuid();
  v_reference_type text;
  v_item public.order_items;
  v_mapping public.product_external_mappings;
  v_items jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_item_count integer := 0;
begin
  if p_device_id is null then raise exception 'Bridge obrigatorio'; end if;
  if p_operation_key is null then raise exception 'OperationId obrigatorio'; end if;
  if v_code is null or v_code = '' then raise exception 'Codigo obrigatorio'; end if;

  select * into v_device
  from public.bridge_devices
  where id = p_device_id and active
  for update;
  if v_device.id is null then raise exception 'Bridge inativo ou inexistente'; end if;

  select * into v_existing
  from public.bridge_dispatches
  where device_id = p_device_id and operation_key = p_operation_key;

  if v_existing.id is not null then
    if v_existing.reference_code <> v_code then
      raise exception 'OperationId reutilizado com codigo diferente';
    end if;
    return v_existing.response_payload || jsonb_build_object(
      'duplicate', true,
      'dispatch_status', v_existing.status
    );
  end if;

  if v_code ~ '^C[1-9][0-9]{0,11}$' then
    v_reference_type := 'comanda';
    select * into v_order
    from public.orders
    where channel = 'comanda'
      and order_number = substring(v_code from 2)::bigint
      and status = 'aberto'
    for update;
    if v_order.id is null then raise exception 'Comanda nao encontrada ou encerrada'; end if;

    if exists (
      select 1 from public.command_requests
      where order_id = v_order.id and status = 'pendente'
    ) then
      raise exception 'Comanda possui solicitacoes pendentes';
    end if;
  elsif v_code ~ '^DV[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    v_reference_type := 'delivery';
    select * into v_order
    from public.orders
    where channel = 'delivery'
      and delivery_code = v_code
      and status in ('confirmado', 'em_preparo', 'pronto', 'saiu_entrega')
    for update;
    if v_order.id is null then raise exception 'Delivery nao encontrado ou ainda nao aceito'; end if;
  else
    raise exception 'Codigo nao pertence ao Renascer';
  end if;

  if exists (
    select 1
    from public.order_items
    where order_id = v_order.id
      and status = 'ativo'
      and service_status <> 'aceito'
  ) then
    raise exception 'Pedido possui itens ainda nao aceitos';
  end if;

  for v_item in
    select *
    from public.order_items
    where order_id = v_order.id and status = 'ativo'
    order by created_at, id
  loop
    v_item_count := v_item_count + 1;

    if v_item.product_id is null then
      raise exception 'Item sem produto vinculado: %', v_item.product_name;
    end if;

    select * into v_mapping
    from public.product_external_mappings m
    where m.provider = 'gemaster'
      and m.product_id = v_item.product_id
      and m.active
      and (m.organization_id is null or m.organization_id = v_device.organization_id)
      and (m.store_id is null or m.store_id = v_device.store_id)
    order by (m.store_id is not null) desc, (m.organization_id is not null) desc
    limit 1;

    if v_mapping.id is null then
      raise exception 'Produto sem mapeamento GeMaster: %', v_item.product_name;
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'external_code', v_mapping.external_code,
      'external_ean', v_mapping.external_ean,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'subtotal', v_item.subtotal,
      'pricing_mode', v_item.pricing_mode,
      'weight_kg', v_item.weight_kg,
      'price_per_kg', v_item.price_per_kg,
      'requires_weight_handling', (v_item.pricing_mode = 'variable'),
      'mapping_id', v_mapping.id
    ));
  end loop;

  if v_item_count = 0 then raise exception 'Pedido sem itens ativos'; end if;

  v_payload := jsonb_build_object(
    'duplicate', false,
    'dispatch_id', v_dispatch_id,
    'dispatch_status', 'prepared',
    'provider', 'gemaster',
    'reference_code', v_code,
    'reference_type', v_reference_type,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'order_status', v_order.status,
    'payment_status', v_order.payment_status,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'command_label', v_order.command_label,
    'items', v_items
  );

  insert into public.bridge_dispatches (
    id, device_id, operation_key, order_id, reference_code, reference_type, status, response_payload
  ) values (
    v_dispatch_id, p_device_id, p_operation_key, v_order.id, v_code, v_reference_type, 'prepared', v_payload
  );

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values (
    'system', 'bridge.dispatch_prepared', 'bridge_dispatch', v_dispatch_id::text,
    jsonb_build_object(
      'device_id', v_device.id,
      'device_name', v_device.name,
      'reference_code', v_code,
      'reference_type', v_reference_type,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'item_count', v_item_count
    )
  );

  return v_payload;
end;
$$;

create or replace function public.update_gemaster_bridge_dispatch_status(
  p_dispatch_id uuid,
  p_device_id uuid,
  p_status text,
  p_error text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dispatch public.bridge_dispatches;
begin
  if p_status not in ('injected', 'failed') then raise exception 'Status do Bridge invalido'; end if;

  select * into v_dispatch
  from public.bridge_dispatches
  where id = p_dispatch_id and device_id = p_device_id
  for update;
  if v_dispatch.id is null then raise exception 'Despacho do Bridge nao encontrado'; end if;

  if v_dispatch.status = p_status then
    return jsonb_build_object(
      'id', v_dispatch.id,
      'status', v_dispatch.status,
      'duplicate', true,
      'order_id', v_dispatch.order_id,
      'reference_code', v_dispatch.reference_code
    );
  end if;

  if v_dispatch.status <> 'prepared' then
    raise exception 'Despacho do Bridge ja finalizado';
  end if;

  update public.bridge_dispatches
  set status = p_status,
      error_message = case when p_status = 'failed' then nullif(trim(p_error), '') else null end,
      injected_at = case when p_status = 'injected' then now() else injected_at end,
      failed_at = case when p_status = 'failed' then now() else failed_at end
  where id = v_dispatch.id
  returning * into v_dispatch;

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values (
    'system',
    case when p_status = 'injected' then 'bridge.dispatch_injected' else 'bridge.dispatch_failed' end,
    'bridge_dispatch',
    v_dispatch.id::text,
    jsonb_build_object(
      'device_id', p_device_id,
      'order_id', v_dispatch.order_id,
      'reference_code', v_dispatch.reference_code,
      'error', v_dispatch.error_message
    )
  );

  return jsonb_build_object(
    'id', v_dispatch.id,
    'status', v_dispatch.status,
    'duplicate', false,
    'order_id', v_dispatch.order_id,
    'reference_code', v_dispatch.reference_code,
    'injected_at', v_dispatch.injected_at,
    'failed_at', v_dispatch.failed_at
  );
end;
$$;

revoke execute on function public.prepare_gemaster_bridge_dispatch(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_gemaster_bridge_dispatch(text, uuid, uuid)
  to service_role;

revoke execute on function public.update_gemaster_bridge_dispatch_status(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_gemaster_bridge_dispatch_status(uuid, uuid, text, text)
  to service_role;

comment on table public.bridge_devices is
  'Computadores autorizados a usar a API do Renascer Bridge. Armazena apenas hash do token.';
comment on table public.product_external_mappings is
  'Mapeia produto Renascer para codigo reconhecido por sistemas externos, inicialmente GeMaster.';
comment on table public.bridge_dispatches is
  'Snapshot idempotente de itens preparados/injetados pelo Bridge. Nao representa pagamento.';
comment on function public.prepare_gemaster_bridge_dispatch(text, uuid, uuid) is
  'Resolve C.../DV..., valida itens/mapeamentos e devolve snapshot para injecao no GeMaster sem dar baixa financeira.';
