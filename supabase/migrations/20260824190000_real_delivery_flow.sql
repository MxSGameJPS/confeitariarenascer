alter table public.orders
  add column tracking_token uuid not null default gen_random_uuid() unique,
  add column preparation_started_at timestamptz,
  add column ready_at timestamptz,
  add column dispatched_at timestamptz,
  add column completed_at timestamptz;

create index orders_tracking_token_idx on public.orders(tracking_token);

create or replace function public.create_order_transaction(
  p_customer jsonb,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order public.orders;
begin
  insert into public.customers (name, phone)
  values (p_customer->>'name', p_customer->>'phone')
  on conflict (phone) do update
  set name = excluded.name, updated_at = now()
  returning id into v_customer_id;

  insert into public.orders (
    customer_id, channel, fulfillment_type, payment_method, payment_status,
    subtotal, delivery_fee, total, change_for, address_street, address_number,
    address_neighborhood, address_complement, address_reference, notes
  ) values (
    v_customer_id, 'delivery', p_order->>'fulfillment_type', p_order->>'payment_method', 'pendente',
    (p_order->>'subtotal')::numeric, coalesce((p_order->>'delivery_fee')::numeric, 0),
    (p_order->>'total')::numeric, nullif(p_order->>'change_for', '')::numeric,
    p_order#>>'{address,street}', p_order#>>'{address,number}',
    p_order#>>'{address,neighborhood}', p_order#>>'{address,complement}',
    p_order#>>'{address,reference}', p_order->>'notes'
  ) returning * into v_order;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, subtotal,
    pricing_mode, service_status
  )
  select v_order.id, (item->>'product_id')::uuid, item->>'product_name',
    (item->>'unit_price')::numeric, (item->>'quantity')::integer,
    (item->>'subtotal')::numeric, coalesce(item->>'pricing_mode', 'fixed'), 'pendente'
  from jsonb_array_elements(p_items) item;

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values ('system', 'delivery.created', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'fulfillment_type', v_order.fulfillment_type));

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'tracking_token', v_order.tracking_token,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'created_at', v_order.created_at
  );
end;
$$;

create or replace function public.accept_delivery_transaction(
  p_order_id uuid,
  p_variable_prices jsonb,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_price numeric(12, 2);
  v_subtotal numeric(12, 2);
begin
  select * into v_order from public.orders
  where id = p_order_id and channel = 'delivery' and status = 'pendente' for update;
  if v_order.id is null then raise exception 'Pedido nao esta pendente'; end if;

  for v_item in select * from public.order_items where order_id = v_order.id and status = 'ativo' for update
  loop
    if v_item.pricing_mode = 'variable' then
      select nullif(entry->>'unit_price', '')::numeric into v_price
      from jsonb_array_elements(p_variable_prices) entry
      where entry->>'item_id' = v_item.id::text limit 1;
      if v_price is null or v_price <= 0 then raise exception 'Preco de item pesado obrigatorio'; end if;
      update public.order_items set unit_price = v_price, subtotal = v_price * quantity
      where id = v_item.id;
    end if;
  end loop;

  update public.order_items set service_status = 'aceito' where order_id = v_order.id and status = 'ativo';
  select coalesce(sum(subtotal), 0) into v_subtotal from public.order_items
  where order_id = v_order.id and status = 'ativo';

  update public.orders set status = 'confirmado', accepted_at = now(), subtotal = v_subtotal,
    total = v_subtotal + delivery_fee,
    responsible_employee_id = case when p_actor_kind = 'employee' then p_actor_id end,
    responsible_admin_id = case when p_actor_kind = 'admin' then p_actor_id end
  where id = v_order.id returning * into v_order;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'delivery.accepted', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total));

  return to_jsonb(v_order);
end;
$$;

create or replace function public.advance_delivery_transaction(
  p_order_id uuid,
  p_next_status text,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.sale_payments;
begin
  select * into v_order from public.orders
  where id = p_order_id and channel = 'delivery' for update;
  if v_order.id is null then raise exception 'Pedido nao encontrado'; end if;

  if not (
    (v_order.status = 'confirmado' and p_next_status = 'em_preparo') or
    (v_order.status = 'em_preparo' and p_next_status = 'pronto') or
    (v_order.status = 'pronto' and v_order.fulfillment_type = 'entrega' and p_next_status = 'saiu_entrega') or
    (v_order.status = 'pronto' and v_order.fulfillment_type = 'retirada' and p_next_status = 'concluido') or
    (v_order.status = 'saiu_entrega' and p_next_status = 'concluido')
  ) then
    raise exception 'Transicao de status invalida';
  end if;

  update public.orders set
    status = p_next_status,
    preparation_started_at = case when p_next_status = 'em_preparo' then now() else preparation_started_at end,
    ready_at = case when p_next_status = 'pronto' then now() else ready_at end,
    dispatched_at = case when p_next_status = 'saiu_entrega' then now() else dispatched_at end,
    completed_at = case when p_next_status = 'concluido' then now() else completed_at end,
    closed_at = case when p_next_status = 'concluido' then now() else closed_at end,
    payment_status = case when p_next_status = 'concluido' then 'pago' else payment_status end
  where id = v_order.id returning * into v_order;

  if p_next_status = 'concluido' then
    insert into public.sale_payments (
      order_id, method, amount, status, received_by_employee_id, received_by_admin_id, confirmed_at
    ) values (
      v_order.id, v_order.payment_method, v_order.total, 'confirmado',
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end, now()
    ) returning * into v_payment;

    insert into public.financial_transactions (
      order_id, payment_id, type, category, description, amount, payment_method,
      status, occurred_at, actor_employee_id, actor_admin_id
    ) values (
      v_order.id, v_payment.id, 'entrada', 'venda',
      'Recebimento do delivery #' || v_order.order_number, v_order.total,
      v_order.payment_method, 'confirmado', now(),
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end
    );
  end if;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'delivery.status_changed', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'status', p_next_status));

  return to_jsonb(v_order);
end;
$$;

revoke execute on function public.accept_delivery_transaction(uuid, text, uuid) from service_role;
drop function if exists public.accept_delivery_transaction(uuid, text, uuid);
revoke execute on function public.create_order_transaction(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.accept_delivery_transaction(uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.advance_delivery_transaction(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_order_transaction(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.accept_delivery_transaction(uuid, jsonb, text, uuid) to service_role;
grant execute on function public.advance_delivery_transaction(uuid, text, text, uuid) to service_role;

comment on column public.orders.tracking_token is 'Token aleatorio usado no acompanhamento publico do pedido sem expor IDs sequenciais.';

