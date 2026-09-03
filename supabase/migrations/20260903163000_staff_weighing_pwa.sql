-- Renascer Pesagem PWA para funcionários.
-- Reaproveita a infraestrutura de pesagem existente, preservando o fluxo futuro
-- de dispositivos físicos e adicionando autoria/idempotência para funcionários.

alter table public.weighing_operations
  alter column device_id drop not null;

alter table public.weighing_operations
  add column if not exists actor_employee_id uuid references public.employees(id) on delete restrict;

alter table public.weighing_operations
  drop constraint if exists weighing_operations_actor_source_check;

alter table public.weighing_operations
  add constraint weighing_operations_actor_source_check check (
    (device_id is not null and actor_employee_id is null)
    or
    (device_id is null and actor_employee_id is not null)
  );

create unique index if not exists weighing_operations_employee_operation_unique_idx
  on public.weighing_operations(actor_employee_id, operation_key)
  where actor_employee_id is not null;

alter table public.order_items
  add column if not exists weighing_employee_id uuid references public.employees(id) on delete restrict;

alter table public.order_items
  drop constraint if exists order_items_weighing_metadata_check;

alter table public.order_items
  add constraint order_items_weighing_metadata_check check (
    weighing_operation_id is null
    or (
      weight_kg is not null and weight_kg > 0
      and price_per_kg is not null and price_per_kg > 0
      and (
        (weighing_device_id is not null and weighing_employee_id is null)
        or
        (weighing_device_id is null and weighing_employee_id is not null)
      )
    )
  );

create or replace function public.register_staff_weighing_item_transaction(
  p_order_number bigint,
  p_product_id uuid,
  p_weight_kg numeric,
  p_operation_key uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee public.employees;
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
  if p_employee_id is null then raise exception 'Funcionario obrigatorio'; end if;
  if p_weight_kg is null or p_weight_kg <= 0 or p_weight_kg > 100 then
    raise exception 'Peso invalido';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and active
  for share;

  if v_employee.id is null then
    raise exception 'Funcionario inativo ou inexistente';
  end if;

  select * into v_operation
  from public.weighing_operations
  where actor_employee_id = p_employee_id
    and operation_key = p_operation_key;

  if v_operation.id is not null then
    if v_operation.product_id <> p_product_id
       or v_operation.weight_kg <> round(p_weight_kg::numeric, 3)
       or not exists (
         select 1
         from public.orders o
         where o.id = v_operation.order_id
           and o.order_number = p_order_number
       ) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select * into v_existing_item
    from public.order_items
    where weighing_operation_id = v_operation.id
    limit 1;

    select total into v_order_total
    from public.orders
    where id = v_operation.order_id;

    return jsonb_build_object(
      'duplicate', true,
      'operation_id', v_operation.id,
      'order_id', v_operation.order_id,
      'order_number', p_order_number,
      'item_id', v_existing_item.id,
      'product_id', v_operation.product_id,
      'product_name', v_existing_item.product_name,
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

  if v_order.id is null then
    raise exception 'Comanda nao encontrada ou encerrada';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and active
    and available_internal
    and pricing_mode = 'variable'
    and price_configured
  for share;

  if v_product.id is null then
    raise exception 'Produto indisponivel para pesagem';
  end if;

  if v_product.price is null or v_product.price <= 0 then
    raise exception 'Produto sem preco por kg valido';
  end if;

  v_total := round(v_product.price * round(p_weight_kg::numeric, 3), 2);
  if v_total <= 0 then raise exception 'Valor calculado invalido'; end if;

  insert into public.weighing_operations (
    device_id,
    actor_employee_id,
    operation_key,
    order_id,
    product_id,
    weight_kg,
    price_per_kg,
    total
  ) values (
    null,
    p_employee_id,
    p_operation_key,
    v_order.id,
    v_product.id,
    round(p_weight_kg::numeric, 3),
    v_product.price,
    v_total
  )
  on conflict do nothing
  returning * into v_operation;

  if v_operation.id is null then
    select * into v_operation
    from public.weighing_operations
    where actor_employee_id = p_employee_id
      and operation_key = p_operation_key;

    if v_operation.id is null
       or v_operation.product_id <> p_product_id
       or v_operation.order_id <> v_order.id
       or v_operation.weight_kg <> round(p_weight_kg::numeric, 3) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select * into v_existing_item
    from public.order_items
    where weighing_operation_id = v_operation.id
    limit 1;

    select total into v_order_total
    from public.orders
    where id = v_order.id;

    return jsonb_build_object(
      'duplicate', true,
      'operation_id', v_operation.id,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'item_id', v_existing_item.id,
      'product_id', v_operation.product_id,
      'product_name', v_existing_item.product_name,
      'weight_kg', v_operation.weight_kg,
      'price_per_kg', v_operation.price_per_kg,
      'item_total', v_operation.total,
      'order_total', v_order_total
    );
  end if;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    subtotal,
    pricing_mode,
    service_status,
    weight_kg,
    price_per_kg,
    weighing_device_id,
    weighing_employee_id,
    weighing_operation_id
  ) values (
    v_order.id,
    v_product.id,
    v_product.name,
    v_total,
    1,
    v_total,
    'variable',
    'aceito',
    round(p_weight_kg::numeric, 3),
    v_product.price,
    null,
    p_employee_id,
    v_operation.id
  )
  returning * into v_item;

  select coalesce(sum(subtotal), 0)
  into v_order_total
  from public.order_items
  where order_id = v_order.id
    and status = 'ativo';

  update public.orders
  set subtotal = v_order_total,
      total = v_order_total + delivery_fee
  where id = v_order.id
  returning total into v_order_total;

  insert into public.audit_logs (
    actor_id,
    actor_employee_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    null,
    p_employee_id,
    'employee',
    'weighing.item_added',
    'order_item',
    v_item.id::text,
    jsonb_build_object(
      'source', 'staff_pwa',
      'employee_id', p_employee_id,
      'employee_name', v_employee.full_name,
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

revoke execute on function public.register_staff_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.register_staff_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid)
  to service_role;

comment on column public.weighing_operations.actor_employee_id is
  'Funcionário responsável por uma pesagem originada no PWA operacional. Nulo para integrações por dispositivo.';

comment on column public.order_items.weighing_employee_id is
  'Funcionário que confirmou a pesagem no Renascer Pesagem PWA.';

comment on function public.register_staff_weighing_item_transaction(bigint, uuid, numeric, uuid, uuid) is
  'Valida funcionário, comanda, produto e peso; recalcula o preço no banco e adiciona o item de forma idempotente.';
