-- Permite que o Renascer Pesagem funcione também como estação rápida de balcão.
-- Produtos de preço fixo entram por quantidade; produtos por peso continuam usando
-- weighing_operations e a RPC específica de pesagem.

alter table public.order_items
  add column if not exists counter_operation_key uuid,
  add column if not exists counter_employee_id uuid references public.employees(id) on delete restrict;

create unique index if not exists order_items_counter_employee_operation_unique_idx
  on public.order_items(counter_employee_id, counter_operation_key)
  where counter_employee_id is not null and counter_operation_key is not null;

alter table public.order_items
  drop constraint if exists order_items_counter_operation_actor_check;

alter table public.order_items
  add constraint order_items_counter_operation_actor_check check (
    (counter_operation_key is null and counter_employee_id is null)
    or
    (counter_operation_key is not null and counter_employee_id is not null)
  );

create or replace function public.register_staff_fixed_counter_item_transaction(
  p_order_number bigint,
  p_product_id uuid,
  p_quantity integer,
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
  if p_quantity is null or p_quantity <= 0 or p_quantity > 999 then
    raise exception 'Quantidade invalida';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and active
  for share;

  if v_employee.id is null then
    raise exception 'Funcionario inativo ou inexistente';
  end if;

  select * into v_existing_item
  from public.order_items
  where counter_employee_id = p_employee_id
    and counter_operation_key = p_operation_key
  limit 1;

  if v_existing_item.id is not null then
    if v_existing_item.product_id <> p_product_id
       or v_existing_item.quantity <> p_quantity
       or not exists (
         select 1
         from public.orders o
         where o.id = v_existing_item.order_id
           and o.order_number = p_order_number
       ) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select total into v_order_total
    from public.orders
    where id = v_existing_item.order_id;

    return jsonb_build_object(
      'duplicate', true,
      'order_id', v_existing_item.order_id,
      'order_number', p_order_number,
      'item_id', v_existing_item.id,
      'product_id', v_existing_item.product_id,
      'product_name', v_existing_item.product_name,
      'pricing_mode', 'fixed',
      'quantity', v_existing_item.quantity,
      'unit_price', v_existing_item.unit_price,
      'item_total', v_existing_item.subtotal,
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
    and pricing_mode = 'fixed'
    and price_configured
  for share;

  if v_product.id is null then
    raise exception 'Produto indisponivel para venda por unidade';
  end if;

  if v_product.price is null or v_product.price <= 0 then
    raise exception 'Produto sem preco unitario valido';
  end if;

  if v_product.stock_control and coalesce(v_product.stock_quantity, 0) < p_quantity then
    raise exception 'Estoque insuficiente para o produto';
  end if;

  v_total := round(v_product.price * p_quantity, 2);
  if v_total <= 0 then raise exception 'Valor calculado invalido'; end if;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    subtotal,
    pricing_mode,
    service_status,
    counter_operation_key,
    counter_employee_id
  ) values (
    v_order.id,
    v_product.id,
    v_product.name,
    v_product.price,
    p_quantity,
    v_total,
    'fixed',
    'aceito',
    p_operation_key,
    p_employee_id
  )
  on conflict do nothing
  returning * into v_item;

  if v_item.id is null then
    select * into v_item
    from public.order_items
    where counter_employee_id = p_employee_id
      and counter_operation_key = p_operation_key
    limit 1;

    if v_item.id is null
       or v_item.order_id <> v_order.id
       or v_item.product_id <> p_product_id
       or v_item.quantity <> p_quantity then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;

    select total into v_order_total
    from public.orders
    where id = v_order.id;

    return jsonb_build_object(
      'duplicate', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'item_id', v_item.id,
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'pricing_mode', 'fixed',
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'item_total', v_item.subtotal,
      'order_total', v_order_total
    );
  end if;

  select coalesce(sum(subtotal), 0)
  into v_order_total
  from public.order_items
  where order_id = v_order.id
    and status = 'ativo';

  update public.orders
  set subtotal = v_order_total,
      total = v_order_total + delivery_fee,
      responsible_employee_id = p_employee_id
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
    'counter.fixed_item_added',
    'order_item',
    v_item.id::text,
    jsonb_build_object(
      'source', 'weighing_pwa',
      'employee_id', p_employee_id,
      'employee_name', v_employee.full_name,
      'operation_key', p_operation_key,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', p_quantity,
      'unit_price', v_product.price,
      'item_total', v_total
    )
  );

  return jsonb_build_object(
    'duplicate', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'item_id', v_item.id,
    'product_id', v_product.id,
    'product_name', v_product.name,
    'pricing_mode', 'fixed',
    'quantity', p_quantity,
    'unit_price', v_product.price,
    'item_total', v_total,
    'order_total', v_order_total
  );
end;
$$;

revoke execute on function public.register_staff_fixed_counter_item_transaction(bigint, uuid, integer, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.register_staff_fixed_counter_item_transaction(bigint, uuid, integer, uuid, uuid)
  to service_role;

comment on column public.order_items.counter_operation_key is
  'Chave idempotente para inclusão de produto fixo originada na estação Renascer Pesagem.';

comment on column public.order_items.counter_employee_id is
  'Funcionário que incluiu um produto fixo pela estação Renascer Pesagem.';

comment on function public.register_staff_fixed_counter_item_transaction(bigint, uuid, integer, uuid, uuid) is
  'Adiciona produto de preço fixo à comanda por quantidade, recalculando preço no banco e garantindo idempotência por funcionário.';
