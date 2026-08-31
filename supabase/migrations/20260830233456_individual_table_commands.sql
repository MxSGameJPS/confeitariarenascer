-- Cada cliente/dispositivo passa a possuir uma comanda independente,
-- mantendo a mesa como agrupador físico da visita.

drop index if exists public.orders_open_table_command_unique_idx;

create index if not exists orders_open_table_commands_idx
  on public.orders(table_id, order_number)
  where table_id is not null and channel = 'comanda' and status = 'aberto';

create or replace function public.open_table_customer_session_transaction(
  p_table_token uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_order public.orders;
  v_session public.command_customer_sessions;
begin
  if nullif(trim(p_customer_name), '') is null
     or char_length(trim(p_customer_name)) not between 2 and 100 then
    raise exception 'Nome do cliente invalido';
  end if;

  if nullif(trim(p_access_token_hash), '') is null then
    raise exception 'Token da comanda invalido';
  end if;

  select * into v_table
  from public.dining_tables
  where public_token = p_table_token
    and active
    and command_enabled;

  if v_table.id is null then
    raise exception 'Mesa indisponivel';
  end if;

  insert into public.orders (
    status,
    channel,
    fulfillment_type,
    payment_status,
    subtotal,
    delivery_fee,
    total,
    command_label,
    table_id
  ) values (
    'aberto',
    'comanda',
    'local',
    'pendente',
    0,
    0,
    0,
    trim(p_customer_name),
    v_table.id
  ) returning * into v_order;

  insert into public.command_customer_sessions (
    table_id,
    order_id,
    customer_name,
    customer_whatsapp,
    access_token_hash
  ) values (
    v_table.id,
    v_order.id,
    trim(p_customer_name),
    nullif(trim(p_customer_whatsapp), ''),
    p_access_token_hash
  ) returning * into v_session;

  insert into public.audit_logs (
    actor_kind,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    'system',
    'command.opened_from_table_qr',
    'order',
    v_order.id::text,
    jsonb_build_object(
      'table_id', v_table.id,
      'table_number', v_table.table_number,
      'order_number', v_order.order_number,
      'customer_session_id', v_session.id,
      'customer_name', v_session.customer_name
    )
  );

  return jsonb_build_object(
    'id', v_session.id,
    'table_id', v_session.table_id,
    'order_id', v_session.order_id,
    'customer_name', v_session.customer_name,
    'customer_whatsapp', v_session.customer_whatsapp,
    'status', v_session.status,
    'joined_at', v_session.joined_at,
    'closed_at', v_session.closed_at,
    'command_number', v_order.order_number,
    'order_status', v_order.status,
    'total', v_order.total,
    'table_number', v_table.table_number
  );
end;
$$;

revoke execute on function public.open_table_customer_session_transaction(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.open_table_customer_session_transaction(uuid, text, text, text)
  to service_role;

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
  where public_token = p_table_token and active and command_enabled;

  if v_table.id is null then
    raise exception 'Mesa indisponivel';
  end if;

  select * into v_session
  from public.command_customer_sessions
  where id = p_customer_session_id
    and table_id = v_table.id
    and status = 'ativo'
  for update;

  if v_session.id is null then
    raise exception 'Sessao da mesa invalida';
  end if;

  if exists (
    select 1
    from public.command_requests
    where customer_session_id = v_session.id
      and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outro pedido';
  end if;

  if v_session.order_id is null then
    -- Compatibilidade com sessoes antigas criadas antes desta migracao.
    insert into public.orders (
      status,
      channel,
      fulfillment_type,
      payment_status,
      subtotal,
      delivery_fee,
      total,
      command_label,
      table_id
    ) values (
      'aberto',
      'comanda',
      'local',
      'pendente',
      0,
      0,
      0,
      v_session.customer_name,
      v_table.id
    ) returning * into v_order;

    update public.command_customer_sessions
    set order_id = v_order.id,
        last_seen_at = now()
    where id = v_session.id
    returning * into v_session;
  else
    select * into v_order
    from public.orders
    where id = v_session.order_id
      and table_id = v_table.id
      and channel = 'comanda'
      and status = 'aberto'
    for update;

    if v_order.id is null then
      raise exception 'Comanda nao esta aberta';
    end if;
  end if;

  insert into public.command_requests (
    table_id,
    order_id,
    customer_session_id,
    customer_name,
    notes
  ) values (
    v_table.id,
    v_order.id,
    v_session.id,
    v_session.customer_name,
    nullif(trim(p_notes), '')
  ) returning * into v_request;

  insert into public.order_items (
    order_id,
    request_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    subtotal,
    pricing_mode,
    service_status
  )
  select
    v_order.id,
    v_request.id,
    nullif(item->>'product_id', '')::uuid,
    item->>'product_name',
    (item->>'unit_price')::numeric,
    (item->>'quantity')::integer,
    (item->>'subtotal')::numeric,
    item->>'pricing_mode',
    'pendente'
  from jsonb_array_elements(p_items) item;

  select coalesce(sum(subtotal), 0) into v_subtotal
  from public.order_items
  where order_id = v_order.id and status = 'ativo';

  update public.orders
  set subtotal = v_subtotal,
      total = v_subtotal + delivery_fee
  where id = v_order.id
  returning * into v_order;

  update public.command_customer_sessions
  set last_seen_at = now()
  where id = v_session.id;

  insert into public.audit_logs (
    actor_kind,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    'system',
    'command.requested',
    'command_request',
    v_request.id::text,
    jsonb_build_object(
      'table_id', v_table.id,
      'table_number', v_table.table_number,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'customer_session_id', v_session.id,
      'customer_name', v_session.customer_name
    )
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'command_number', v_order.order_number,
    'table_number', v_table.table_number,
    'status', v_request.status,
    'created_at', v_request.created_at,
    'subtotal', v_order.subtotal,
    'total', v_order.total
  );
end;
$$;

revoke execute on function public.create_table_command_request_v2(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_table_command_request_v2(uuid, uuid, text, jsonb)
  to service_role;

comment on function public.open_table_customer_session_transaction(uuid, text, text, text) is
  'Abre uma comanda individual para um cliente/dispositivo identificado pelo QR Code de uma mesa.';
comment on table public.command_customer_sessions is
  'Participantes identificados por aparelho; cada sessao ativa aponta para sua propria comanda, agrupada pela mesa.';
