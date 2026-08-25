create table public.command_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  customer_whatsapp text,
  access_token_hash text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  joined_at timestamptz not null default now(),
  closed_at timestamptz,
  last_seen_at timestamptz not null default now()
);

alter table public.command_requests
  add column customer_session_id uuid references public.command_customer_sessions(id) on delete set null;

create index command_customer_sessions_table_status_idx
  on public.command_customer_sessions(table_id, status, joined_at desc);
create index command_customer_sessions_order_idx
  on public.command_customer_sessions(order_id, joined_at);
create index command_requests_customer_session_idx
  on public.command_requests(customer_session_id, created_at desc);

alter table public.command_customer_sessions enable row level security;
revoke all on table public.command_customer_sessions from public, anon, authenticated;
grant all on table public.command_customer_sessions to service_role;

create or replace function public.create_table_command_request_v2(
  p_table_token uuid,
  p_customer_session_id uuid,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_session public.command_customer_sessions;
  v_order public.orders;
  v_request public.command_requests;
  v_subtotal numeric(12, 2);
begin
  select * into v_table
  from public.dining_tables
  where public_token = p_table_token and active and command_enabled
  for update;

  if v_table.id is null then raise exception 'Mesa indisponivel'; end if;

  select * into v_session
  from public.command_customer_sessions
  where id = p_customer_session_id and table_id = v_table.id and status = 'ativo'
  for update;

  if v_session.id is null then raise exception 'Sessao da mesa invalida'; end if;

  if exists (
    select 1 from public.command_requests
    where customer_session_id = v_session.id and created_at > now() - interval '5 seconds'
  ) then raise exception 'Aguarde alguns segundos antes de enviar outro pedido'; end if;

  select * into v_order
  from public.orders
  where table_id = v_table.id and channel = 'comanda' and status = 'aberto'
  limit 1 for update;

  if v_order.id is null then
    insert into public.orders (
      status, channel, fulfillment_type, payment_status, subtotal, delivery_fee, total,
      command_label, table_id
    ) values (
      'aberto', 'comanda', 'local', 'pendente', 0, 0, 0,
      'Mesa ' || v_table.table_number, v_table.id
    ) returning * into v_order;
  end if;

  update public.command_customer_sessions
  set order_id = v_order.id, last_seen_at = now()
  where table_id = v_table.id and status = 'ativo' and order_id is null;

  insert into public.command_requests (
    table_id, order_id, customer_session_id, customer_name, notes
  ) values (
    v_table.id, v_order.id, v_session.id, v_session.customer_name, nullif(trim(p_notes), '')
  ) returning * into v_request;

  insert into public.order_items (
    order_id, request_id, product_id, product_name, unit_price, quantity, subtotal,
    pricing_mode, service_status
  )
  select
    v_order.id, v_request.id, nullif(item->>'product_id', '')::uuid, item->>'product_name',
    (item->>'unit_price')::numeric, (item->>'quantity')::integer, (item->>'subtotal')::numeric,
    item->>'pricing_mode', 'pendente'
  from jsonb_array_elements(p_items) item;

  select coalesce(sum(subtotal), 0) into v_subtotal
  from public.order_items where order_id = v_order.id and status = 'ativo';

  update public.orders set subtotal = v_subtotal, total = v_subtotal + delivery_fee
  where id = v_order.id returning * into v_order;

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values ('system', 'command.requested', 'command_request', v_request.id::text,
    jsonb_build_object('table_id', v_table.id, 'table_number', v_table.table_number,
      'order_id', v_order.id, 'order_number', v_order.order_number,
      'customer_session_id', v_session.id, 'customer_name', v_session.customer_name));

  return jsonb_build_object(
    'request_id', v_request.id, 'order_id', v_order.id,
    'order_number', v_order.order_number, 'table_number', v_table.table_number,
    'status', v_request.status, 'created_at', v_request.created_at,
    'subtotal', v_order.subtotal, 'total', v_order.total
  );
end;
$$;

create or replace function public.reject_command_request_transaction(
  p_request_id uuid,
  p_reason text,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.command_requests;
  v_subtotal numeric(12, 2);
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Motivo obrigatorio'; end if;

  select * into v_request from public.command_requests
  where id = p_request_id and status = 'pendente' for update;
  if v_request.id is null then raise exception 'Solicitacao nao esta pendente'; end if;

  update public.order_items
  set status = 'cancelado', service_status = 'cancelado', canceled_at = now(),
      cancellation_reason = trim(p_reason),
      canceled_by_employee_id = case when p_actor_kind = 'employee' then p_actor_id end,
      canceled_by_admin_id = case when p_actor_kind = 'admin' then p_actor_id end
  where request_id = v_request.id and status = 'ativo';

  update public.command_requests
  set status = 'cancelado'
  where id = v_request.id returning * into v_request;

  select coalesce(sum(subtotal), 0) into v_subtotal from public.order_items
  where order_id = v_request.order_id and status = 'ativo';
  update public.orders set subtotal = v_subtotal, total = v_subtotal + delivery_fee
  where id = v_request.order_id;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'command.request_rejected', 'command_request', v_request.id::text,
    jsonb_build_object('order_id', v_request.order_id, 'table_id', v_request.table_id, 'reason', trim(p_reason)));

  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.create_table_command_request_v2(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.reject_command_request_transaction(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_table_command_request_v2(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.reject_command_request_transaction(uuid, text, text, uuid) to service_role;

comment on table public.command_customer_sessions is
  'Participantes identificados por aparelho em uma comanda de mesa.';

create or replace function public.sync_command_customer_sessions_on_close()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.channel = 'comanda' and new.status in ('concluido', 'cancelado')
    and old.status is distinct from new.status then
    update public.command_customer_sessions
    set status = 'encerrado', closed_at = coalesce(closed_at, now()), last_seen_at = now()
    where order_id = new.id and status = 'ativo';
  end if;
  return new;
end;
$$;

create trigger orders_sync_command_customer_sessions
after update of status on public.orders
for each row execute function public.sync_command_customer_sessions_on_close();

revoke execute on function public.sync_command_customer_sessions_on_close() from public, anon, authenticated;

create or replace function public.add_command_items_transaction(
  p_order_id uuid,
  p_items jsonb,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders;
  v_subtotal numeric(12, 2);
begin
  select * into v_order from public.orders
  where id = p_order_id and channel = 'comanda' and status = 'aberto' for update;
  if v_order.id is null then raise exception 'Comanda nao esta aberta'; end if;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, quantity, subtotal,
    pricing_mode, service_status
  )
  select v_order.id, nullif(item->>'product_id', '')::uuid, item->>'product_name',
    (item->>'unit_price')::numeric, (item->>'quantity')::integer, (item->>'subtotal')::numeric,
    coalesce(nullif(item->>'pricing_mode', ''), 'fixed'), 'aceito'
  from jsonb_array_elements(p_items) item;

  select coalesce(sum(subtotal), 0) into v_subtotal from public.order_items
  where order_id = v_order.id and status = 'ativo';
  update public.orders set subtotal = v_subtotal, total = v_subtotal + delivery_fee,
    responsible_employee_id = case when p_actor_kind = 'employee' then p_actor_id else responsible_employee_id end,
    responsible_admin_id = case when p_actor_kind = 'admin' then p_actor_id else responsible_admin_id end
  where id = v_order.id returning * into v_order;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'command.items_added', 'order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'items_count', jsonb_array_length(p_items)));
  return to_jsonb(v_order);
end;
$$;

revoke execute on function public.add_command_items_transaction(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.add_command_items_transaction(uuid, jsonb, text, uuid) to service_role;
