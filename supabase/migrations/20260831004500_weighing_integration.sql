-- Integração segura do Renascer Pesagem com comandas.
-- O dispositivo envia produto + peso; preço e total são calculados no banco.

alter table public.products
  add column if not exists weighing_code text;

create unique index if not exists products_weighing_code_unique_idx
  on public.products (upper(weighing_code))
  where weighing_code is not null;

alter table public.products
  drop constraint if exists products_weighing_code_check;

alter table public.products
  add constraint products_weighing_code_check check (
    weighing_code is null
    or (
      weighing_code = upper(weighing_code)
      and weighing_code ~ '^[A-Z0-9._-]{1,32}$'
    )
  );

create table if not exists public.weighing_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  created_by_admin_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weighing_devices_active_idx
  on public.weighing_devices(active, name);

create table if not exists public.weighing_operations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.weighing_devices(id) on delete restrict,
  operation_key uuid not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  weight_kg numeric(12, 3) not null check (weight_kg > 0),
  price_per_kg numeric(12, 2) not null check (price_per_kg > 0),
  total numeric(12, 2) not null check (total > 0),
  created_at timestamptz not null default now(),
  unique(device_id, operation_key)
);

create index if not exists weighing_operations_order_idx
  on public.weighing_operations(order_id, created_at desc);
create index if not exists weighing_operations_product_idx
  on public.weighing_operations(product_id, created_at desc);

alter table public.order_items
  add column if not exists weight_kg numeric(12, 3),
  add column if not exists price_per_kg numeric(12, 2),
  add column if not exists weighing_device_id uuid references public.weighing_devices(id) on delete set null,
  add column if not exists weighing_operation_id uuid references public.weighing_operations(id) on delete set null;

create unique index if not exists order_items_weighing_operation_unique_idx
  on public.order_items(weighing_operation_id)
  where weighing_operation_id is not null;

alter table public.order_items
  drop constraint if exists order_items_weighing_metadata_check;

alter table public.order_items
  add constraint order_items_weighing_metadata_check check (
    weighing_operation_id is null
    or (
      weight_kg is not null and weight_kg > 0
      and price_per_kg is not null and price_per_kg > 0
      and weighing_device_id is not null
    )
  );

alter table public.weighing_devices enable row level security;
alter table public.weighing_operations enable row level security;

revoke all on table public.weighing_devices from public, anon, authenticated;
revoke all on table public.weighing_operations from public, anon, authenticated;
grant all on table public.weighing_devices to service_role;
grant all on table public.weighing_operations to service_role;

drop trigger if exists weighing_devices_set_updated_at on public.weighing_devices;
create trigger weighing_devices_set_updated_at
before update on public.weighing_devices
for each row execute function public.set_updated_at();

create or replace function public.register_weighing_item_transaction(
  p_order_number bigint,
  p_product_id uuid,
  p_weight_kg numeric,
  p_operation_key uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_device public.weighing_devices;
  v_order public.orders;
  v_product public.products;
  v_operation public.weighing_operations;
  v_existing_item public.order_items;
  v_item public.order_items;
  v_total numeric(12, 2);
  v_order_total numeric(12, 2);
begin
  if p_order_number is null or p_order_number <= 0 then
    raise exception 'Numero da comanda invalido';
  end if;
  if p_product_id is null then raise exception 'Produto obrigatorio'; end if;
  if p_operation_key is null then raise exception 'OperationId obrigatorio'; end if;
  if p_device_id is null then raise exception 'Dispositivo obrigatorio'; end if;
  if p_weight_kg is null or p_weight_kg <= 0 or p_weight_kg > 100 then
    raise exception 'Peso invalido';
  end if;

  select * into v_device
  from public.weighing_devices
  where id = p_device_id and active
  for update;
  if v_device.id is null then raise exception 'Dispositivo de pesagem inativo ou inexistente'; end if;

  -- Resposta idempotente para retransmissões do mesmo aparelho.
  select * into v_operation
  from public.weighing_operations
  where device_id = p_device_id and operation_key = p_operation_key;

  if v_operation.id is not null then
    if v_operation.product_id <> p_product_id
       or v_operation.weight_kg <> round(p_weight_kg::numeric, 3)
       or not exists (
         select 1 from public.orders o
         where o.id = v_operation.order_id and o.order_number = p_order_number
       ) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select * into v_existing_item
    from public.order_items
    where weighing_operation_id = v_operation.id
    limit 1;

    select total into v_order_total from public.orders where id = v_operation.order_id;

    return jsonb_build_object(
      'duplicate', true,
      'operation_id', v_operation.id,
      'order_id', v_operation.order_id,
      'order_number', p_order_number,
      'item_id', v_existing_item.id,
      'product_id', v_operation.product_id,
      'weight_kg', v_operation.weight_kg,
      'price_per_kg', v_operation.price_per_kg,
      'item_total', v_operation.total,
      'order_total', v_order_total
    );
  end if;

  select * into v_order
  from public.orders
  where order_number = p_order_number
    and channel = 'comanda'
    and status = 'aberto'
  for update;
  if v_order.id is null then raise exception 'Comanda nao encontrada ou encerrada'; end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and active
    and available_internal
    and pricing_mode = 'variable'
  for share;
  if v_product.id is null then raise exception 'Produto indisponivel para pesagem'; end if;
  if v_product.price is null or v_product.price <= 0 then
    raise exception 'Produto sem preco por kg valido';
  end if;

  v_total := round(v_product.price * round(p_weight_kg::numeric, 3), 2);
  if v_total <= 0 then raise exception 'Valor calculado invalido'; end if;

  insert into public.weighing_operations (
    device_id, operation_key, order_id, product_id, weight_kg, price_per_kg, total
  ) values (
    p_device_id, p_operation_key, v_order.id, v_product.id,
    round(p_weight_kg::numeric, 3), v_product.price, v_total
  )
  on conflict (device_id, operation_key) do nothing
  returning * into v_operation;

  -- Trata duas retransmissões simultâneas da mesma operação.
  if v_operation.id is null then
    select * into v_operation
    from public.weighing_operations
    where device_id = p_device_id and operation_key = p_operation_key;

    if v_operation.product_id <> p_product_id
       or v_operation.order_id <> v_order.id
       or v_operation.weight_kg <> round(p_weight_kg::numeric, 3) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select * into v_existing_item
    from public.order_items
    where weighing_operation_id = v_operation.id
    limit 1;

    return jsonb_build_object(
      'duplicate', true,
      'operation_id', v_operation.id,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'item_id', v_existing_item.id,
      'product_id', v_operation.product_id,
      'weight_kg', v_operation.weight_kg,
      'price_per_kg', v_operation.price_per_kg,
      'item_total', v_operation.total,
      'order_total', v_order.total
    );
  end if;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, subtotal,
    pricing_mode, service_status, weight_kg, price_per_kg,
    weighing_device_id, weighing_operation_id
  ) values (
    v_order.id, v_product.id, v_product.name, v_total, 1, v_total,
    'variable', 'aceito', round(p_weight_kg::numeric, 3), v_product.price,
    p_device_id, v_operation.id
  ) returning * into v_item;

  select coalesce(sum(subtotal), 0) into v_order_total
  from public.order_items
  where order_id = v_order.id and status = 'ativo';

  update public.orders
  set subtotal = v_order_total,
      total = v_order_total + delivery_fee
  where id = v_order.id
  returning total into v_order_total;

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values (
    'system', 'weighing.item_added', 'order_item', v_item.id::text,
    jsonb_build_object(
      'device_id', p_device_id,
      'device_name', v_device.name,
      'operation_id', v_operation.id,
      'operation_key', p_operation_key,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'product_id', v_product.id,
      'product_name', v_product.name,
      'weight_kg', v_operation.weight_kg,
      'price_per_kg', v_operation.price_per_kg,
      'item_total', v_operation.total
    )
  );

  return jsonb_build_object(
    'duplicate', false,
    'operation_id', v_operation.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'item_id', v_item.id,
    'product_id', v_product.id,
    'product_name', v_product.name,
    'weight_kg', v_operation.weight_kg,
    'price_per_kg', v_operation.price_per_kg,
    'item_total', v_operation.total,
    'order_total', v_order_total
  );
end;
$$;

revoke execute on function public.register_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.register_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid)
  to service_role;

comment on column public.products.weighing_code is
  'Codigo curto opcional usado pelo Renascer Pesagem para localizar produtos pesados.';
comment on table public.weighing_devices is
  'Dispositivos autorizados a usar a API do Renascer Pesagem. Armazena somente hash do token.';
comment on table public.weighing_operations is
  'Registro idempotente e auditavel de cada pesagem enviada por um dispositivo.';
comment on function public.register_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid) is
  'Valida dispositivo/comanda/produto, calcula pelo preco por kg do backend e adiciona uma unica vez à comanda.';
