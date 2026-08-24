alter table public.orders
  alter column customer_id drop not null,
  alter column payment_method drop not null,
  add column channel text not null default 'delivery',
  add column command_label text,
  add column responsible_employee_id uuid references public.employees(id) on delete set null,
  add column responsible_admin_id uuid references auth.users(id) on delete set null,
  add column accepted_at timestamptz,
  add column closed_at timestamptz,
  add column canceled_at timestamptz,
  add column cancellation_reason text;

alter table public.orders
  drop constraint if exists orders_status_check,
  drop constraint if exists orders_fulfillment_type_check,
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_status_check check (
    status in ('pendente', 'aberto', 'confirmado', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado')
  ),
  add constraint orders_channel_check check (channel in ('delivery', 'pos', 'comanda')),
  add constraint orders_fulfillment_type_check check (fulfillment_type in ('entrega', 'retirada', 'local')),
  add constraint orders_payment_method_check check (
    payment_method is null or payment_method in ('dinheiro', 'pix', 'credito', 'debito')
  ),
  add constraint orders_command_label_check check (
    (channel = 'comanda' and nullif(trim(command_label), '') is not null)
    or (channel <> 'comanda' and command_label is null)
  ),
  add constraint orders_responsible_actor_check check (
    not (responsible_employee_id is not null and responsible_admin_id is not null)
  );

alter table public.order_items
  add column status text not null default 'ativo',
  add column canceled_at timestamptz,
  add column cancellation_reason text,
  add column canceled_by_employee_id uuid references public.employees(id) on delete set null,
  add column canceled_by_admin_id uuid references auth.users(id) on delete set null,
  add constraint order_items_status_check check (status in ('ativo', 'cancelado')),
  add constraint order_items_canceled_actor_check check (
    not (canceled_by_employee_id is not null and canceled_by_admin_id is not null)
  );

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method text not null check (method in ('dinheiro', 'pix', 'credito', 'debito')),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'confirmado' check (status in ('pendente', 'confirmado', 'cancelado', 'estornado')),
  received_by_employee_id uuid references public.employees(id) on delete set null,
  received_by_admin_id uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_payments_receiver_check check (
    not (received_by_employee_id is not null and received_by_admin_id is not null)
  )
);

alter table public.financial_transactions
  add column payment_id uuid references public.sale_payments(id) on delete set null,
  add column actor_employee_id uuid references public.employees(id) on delete set null,
  add column actor_admin_id uuid references auth.users(id) on delete set null,
  add constraint financial_transactions_actor_check check (
    not (actor_employee_id is not null and actor_admin_id is not null)
  );

create unique index sale_payments_financial_unique_idx
  on public.financial_transactions(payment_id)
  where payment_id is not null and type = 'entrada';
create index orders_channel_status_created_idx on public.orders(channel, status, created_at desc);
create index orders_responsible_employee_idx on public.orders(responsible_employee_id, created_at desc);
create index sale_payments_order_idx on public.sale_payments(order_id, created_at);

alter table public.sale_payments enable row level security;
revoke all on table public.sale_payments from public, anon, authenticated;
grant all on table public.sale_payments to service_role;

drop trigger if exists sale_payments_set_updated_at on public.sale_payments;
create trigger sale_payments_set_updated_at
before update on public.sale_payments
for each row execute function public.set_updated_at();

create or replace function public.create_operational_sale_transaction(
  p_sale jsonb,
  p_items jsonb,
  p_payments jsonb,
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
  v_channel text := p_sale->>'channel';
  v_status text;
  v_payment_total numeric(12, 2);
begin
  if v_channel not in ('pos', 'comanda') then
    raise exception 'Canal operacional invalido';
  end if;

  v_status := case when v_channel = 'pos' then 'concluido' else 'aberto' end;

  if v_channel = 'pos' then
    select coalesce(sum((entry->>'amount')::numeric), 0)
      into v_payment_total
    from jsonb_array_elements(p_payments) entry;
    if v_payment_total <> (p_sale->>'total')::numeric then
      raise exception 'Pagamentos devem totalizar a venda';
    end if;
  elsif jsonb_array_length(p_payments) > 0 then
    raise exception 'Comanda aberta nao recebe pagamento';
  end if;

  insert into public.orders (
    customer_id, status, channel, fulfillment_type, payment_method, payment_status,
    subtotal, delivery_fee, total, change_for, command_label, notes,
    responsible_employee_id, responsible_admin_id, closed_at
  ) values (
    nullif(p_sale->>'customer_id', '')::uuid,
    v_status,
    v_channel,
    'local',
    case when jsonb_array_length(p_payments) = 1 then p_payments->0->>'method' else null end,
    case when v_channel = 'pos' then 'pago' else 'pendente' end,
    (p_sale->>'subtotal')::numeric,
    0,
    (p_sale->>'total')::numeric,
    nullif(p_sale->>'change_for', '')::numeric,
    nullif(trim(p_sale->>'command_label'), ''),
    nullif(trim(p_sale->>'notes'), ''),
    case when p_actor_kind = 'employee' then p_actor_id end,
    case when p_actor_kind = 'admin' then p_actor_id end,
    case when v_channel = 'pos' then now() end
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
  select v_order.id, (item->>'product_id')::uuid, item->>'product_name',
    (item->>'unit_price')::numeric, (item->>'quantity')::integer, (item->>'subtotal')::numeric
  from jsonb_array_elements(p_items) item;

  for v_payment in
    insert into public.sale_payments (
      order_id, method, amount, status, received_by_employee_id, received_by_admin_id, confirmed_at
    )
    select v_order.id, entry->>'method', (entry->>'amount')::numeric, 'confirmado',
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end,
      now()
    from jsonb_array_elements(p_payments) entry
    returning *
  loop
    insert into public.financial_transactions (
      order_id, payment_id, type, category, description, amount, payment_method, status,
      occurred_at, actor_employee_id, actor_admin_id
    ) values (
      v_order.id, v_payment.id, 'entrada', 'venda', 'Recebimento da venda #' || v_order.order_number,
      v_payment.amount, v_payment.method, 'confirmado', now(),
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end
    );
  end loop;

  insert into public.audit_logs (
    actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'sale.created', 'order', v_order.id::text,
    jsonb_build_object('channel', v_channel, 'order_number', v_order.order_number, 'total', v_order.total)
  );

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number,
    'channel', v_order.channel, 'status', v_order.status, 'payment_status', v_order.payment_status,
    'subtotal', v_order.subtotal, 'total', v_order.total, 'created_at', v_order.created_at);
end;
$$;

create or replace function public.accept_delivery_transaction(
  p_order_id uuid,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_order public.orders;
begin
  update public.orders set
    status = 'confirmado', accepted_at = now(),
    responsible_employee_id = case when p_actor_kind = 'employee' then p_actor_id end,
    responsible_admin_id = case when p_actor_kind = 'admin' then p_actor_id end
  where id = p_order_id and channel = 'delivery' and status = 'pendente'
  returning * into v_order;
  if v_order.id is null then raise exception 'Pedido nao esta pendente'; end if;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'delivery.accepted', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number));
  return to_jsonb(v_order);
end;
$$;

create or replace function public.close_command_transaction(
  p_order_id uuid,
  p_payments jsonb,
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
  v_payment_total numeric(12, 2);
begin
  select * into v_order from public.orders
  where id = p_order_id and channel = 'comanda' and status = 'aberto' for update;
  if v_order.id is null then raise exception 'Comanda nao esta aberta'; end if;

  select coalesce(sum((entry->>'amount')::numeric), 0) into v_payment_total
  from jsonb_array_elements(p_payments) entry;
  if v_payment_total <> v_order.total then raise exception 'Pagamentos devem totalizar a comanda'; end if;

  for v_payment in
    insert into public.sale_payments (order_id, method, amount, status, received_by_employee_id, received_by_admin_id, confirmed_at)
    select v_order.id, entry->>'method', (entry->>'amount')::numeric, 'confirmado',
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end, now()
    from jsonb_array_elements(p_payments) entry returning *
  loop
    insert into public.financial_transactions (
      order_id, payment_id, type, category, description, amount, payment_method, status,
      occurred_at, actor_employee_id, actor_admin_id
    ) values (
      v_order.id, v_payment.id, 'entrada', 'venda', 'Fechamento da comanda #' || v_order.order_number,
      v_payment.amount, v_payment.method, 'confirmado', now(),
      case when p_actor_kind = 'employee' then p_actor_id end,
      case when p_actor_kind = 'admin' then p_actor_id end
    );
  end loop;

  update public.orders set status = 'concluido', payment_status = 'pago', closed_at = now(),
    payment_method = case when jsonb_array_length(p_payments) = 1 then p_payments->0->>'method' else null end
  where id = v_order.id returning * into v_order;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'command.closed', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total));
  return to_jsonb(v_order);
end;
$$;

create or replace function public.cancel_sale_transaction(
  p_order_id uuid,
  p_item_id uuid,
  p_reason text,
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
  v_new_subtotal numeric(12, 2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.status = 'cancelado' then raise exception 'Venda nao pode ser cancelada'; end if;

  if p_item_id is not null then
    update public.order_items set status = 'cancelado', canceled_at = now(), cancellation_reason = p_reason,
      canceled_by_employee_id = case when p_actor_kind = 'employee' then p_actor_id end,
      canceled_by_admin_id = case when p_actor_kind = 'admin' then p_actor_id end
    where id = p_item_id and order_id = p_order_id and status = 'ativo' returning * into v_item;
    if v_item.id is null then raise exception 'Item nao pode ser cancelado'; end if;

    select coalesce(sum(subtotal), 0) into v_new_subtotal from public.order_items
    where order_id = p_order_id and status = 'ativo';
    update public.orders set subtotal = v_new_subtotal,
      total = v_new_subtotal + delivery_fee
    where id = p_order_id returning * into v_order;

    if v_order.payment_status = 'pago' then
      insert into public.financial_transactions (
        order_id, type, category, description, amount, payment_method, status, occurred_at,
        actor_employee_id, actor_admin_id
      ) values (
        v_order.id, 'saida', 'estorno', 'Estorno de item da venda #' || v_order.order_number,
        v_item.subtotal, v_order.payment_method, 'confirmado', now(),
        case when p_actor_kind = 'employee' then p_actor_id end,
        case when p_actor_kind = 'admin' then p_actor_id end
      );
    end if;
  else
    update public.orders set status = 'cancelado', payment_status = 'cancelado',
      canceled_at = now(), cancellation_reason = p_reason
    where id = p_order_id returning * into v_order;
    update public.sale_payments set status = 'cancelado', canceled_at = now()
      where order_id = p_order_id and status in ('pendente', 'confirmado');
    update public.financial_transactions set status = 'cancelado'
      where order_id = p_order_id and status = 'confirmado';
  end if;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, case when p_item_id is null then 'sale.canceled' else 'sale.item_canceled' end,
    case when p_item_id is null then 'order' else 'order_item' end,
    coalesce(p_item_id, p_order_id)::text,
    jsonb_build_object('order_id', p_order_id, 'reason', p_reason));
  return to_jsonb(v_order);
end;
$$;

revoke execute on function public.create_operational_sale_transaction(jsonb, jsonb, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.accept_delivery_transaction(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.close_command_transaction(uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function public.cancel_sale_transaction(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_operational_sale_transaction(jsonb, jsonb, jsonb, text, uuid) to service_role;
grant execute on function public.accept_delivery_transaction(uuid, text, uuid) to service_role;
grant execute on function public.close_command_transaction(uuid, jsonb, text, uuid) to service_role;
grant execute on function public.cancel_sale_transaction(uuid, uuid, text, text, uuid) to service_role;

comment on table public.orders is 'Modelo central de pedidos e vendas para delivery, caixa e comandas.';
comment on table public.sale_payments is 'Pagamentos de vendas, inclusive pagamentos divididos.';
