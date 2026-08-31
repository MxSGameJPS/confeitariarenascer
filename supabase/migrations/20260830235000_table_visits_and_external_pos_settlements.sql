-- Agrupa comandas individuais em um atendimento físico da mesa e prepara
-- o fechamento idempotente vindo de um PDV externo (ex.: GeMaster via Bridge).

create table public.table_visits (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  status text not null default 'aberto'
    check (status in ('aberto', 'ocupado', 'encerrado')),
  opened_at timestamptz not null default now(),
  occupied_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_visits_timestamps_check check (
    (occupied_at is null or occupied_at >= opened_at)
    and (closed_at is null or closed_at >= opened_at)
  )
);

create unique index table_visits_one_active_per_table_idx
  on public.table_visits(table_id)
  where status in ('aberto', 'ocupado');

create index table_visits_status_table_idx
  on public.table_visits(status, table_id, opened_at desc);

alter table public.orders
  add column table_visit_id uuid references public.table_visits(id) on delete restrict;

create index orders_table_visit_status_idx
  on public.orders(table_visit_id, status, order_number)
  where table_visit_id is not null and channel = 'comanda';

alter table public.table_visits enable row level security;
revoke all on table public.table_visits from public, anon, authenticated;
grant all on table public.table_visits to service_role;

drop trigger if exists table_visits_set_updated_at on public.table_visits;
create trigger table_visits_set_updated_at
before update on public.table_visits
for each row execute function public.set_updated_at();

-- Preserva comandas já abertas no momento em que a migration for aplicada.
insert into public.table_visits (table_id, status, opened_at, occupied_at)
select
  o.table_id,
  case
    when bool_or(o.accepted_at is not null)
      or exists (
        select 1
        from public.command_requests cr
        join public.orders io on io.id = cr.order_id
        where io.table_id = o.table_id
          and io.channel = 'comanda'
          and io.status = 'aberto'
          and cr.status = 'aceito'
      )
    then 'ocupado'
    else 'aberto'
  end,
  min(o.created_at),
  case
    when bool_or(o.accepted_at is not null)
      or exists (
        select 1
        from public.command_requests cr
        join public.orders io on io.id = cr.order_id
        where io.table_id = o.table_id
          and io.channel = 'comanda'
          and io.status = 'aberto'
          and cr.status = 'aceito'
      )
    then min(o.created_at)
    else null
  end
from public.orders o
where o.channel = 'comanda'
  and o.status = 'aberto'
  and o.table_id is not null
group by o.table_id;

update public.orders o
set table_visit_id = tv.id
from public.table_visits tv
where o.channel = 'comanda'
  and o.status = 'aberto'
  and o.table_id = tv.table_id
  and tv.status in ('aberto', 'ocupado')
  and o.table_visit_id is null;

create table public.external_pos_settlements (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null unique
    check (char_length(operation_key) between 8 and 160),
  provider text not null default 'gemaster'
    check (char_length(provider) between 2 and 50),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_number bigint not null,
  external_reference text,
  created_at timestamptz not null default now()
);

create index external_pos_settlements_order_idx
  on public.external_pos_settlements(order_id, created_at desc);

alter table public.external_pos_settlements enable row level security;
revoke all on table public.external_pos_settlements from public, anon, authenticated;
grant all on table public.external_pos_settlements to service_role;

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
  v_visit public.table_visits;
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
    and command_enabled
  for update;

  if v_table.id is null then
    raise exception 'Mesa indisponivel';
  end if;

  select * into v_visit
  from public.table_visits
  where table_id = v_table.id
    and status in ('aberto', 'ocupado')
  order by opened_at desc
  limit 1
  for update;

  if v_visit.id is null then
    insert into public.table_visits (table_id, status)
    values (v_table.id, 'aberto')
    returning * into v_visit;

    insert into public.audit_logs (
      actor_kind, action, entity_type, entity_id, metadata
    ) values (
      'system',
      'table_visit.opened',
      'table_visit',
      v_visit.id::text,
      jsonb_build_object(
        'table_id', v_table.id,
        'table_number', v_table.table_number
      )
    );
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
    table_id,
    table_visit_id
  ) values (
    'aberto',
    'comanda',
    'local',
    'pendente',
    0,
    0,
    0,
    trim(p_customer_name),
    v_table.id,
    v_visit.id
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
      'table_visit_id', v_visit.id,
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
    'table_number', v_table.table_number,
    'table_visit_id', v_visit.id,
    'table_visit_status', v_visit.status
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
  v_visit public.table_visits;
  v_session public.command_customer_sessions;
  v_order public.orders;
  v_request public.command_requests;
  v_subtotal numeric(12, 2);
begin
  select * into v_table
  from public.dining_tables
  where public_token = p_table_token and active and command_enabled
  for update;

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
    select * into v_visit
    from public.table_visits
    where table_id = v_table.id
      and status in ('aberto', 'ocupado')
    order by opened_at desc
    limit 1
    for update;

    if v_visit.id is null then
      insert into public.table_visits (table_id, status)
      values (v_table.id, 'aberto')
      returning * into v_visit;
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
      table_id,
      table_visit_id
    ) values (
      'aberto',
      'comanda',
      'local',
      'pendente',
      0,
      0,
      0,
      v_session.customer_name,
      v_table.id,
      v_visit.id
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

    if v_order.table_visit_id is null then
      select * into v_visit
      from public.table_visits
      where table_id = v_table.id
        and status in ('aberto', 'ocupado')
      order by opened_at desc
      limit 1
      for update;

      if v_visit.id is null then
        insert into public.table_visits (table_id, status)
        values (v_table.id, 'aberto')
        returning * into v_visit;
      end if;

      update public.orders
      set table_visit_id = v_visit.id
      where id = v_order.id
      returning * into v_order;
    else
      select * into v_visit
      from public.table_visits
      where id = v_order.table_visit_id
        and status in ('aberto', 'ocupado')
      for update;

      if v_visit.id is null then
        raise exception 'Atendimento da mesa ja foi encerrado';
      end if;
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
      'table_visit_id', v_order.table_visit_id,
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
    'table_visit_id', v_order.table_visit_id,
    'table_visit_status', v_visit.status,
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

create or replace function public.mark_table_visit_occupied_on_request_accept()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_visit_id uuid;
  v_updated integer;
begin
  if new.status = 'aceito' and old.status is distinct from new.status then
    select o.table_visit_id into v_visit_id
    from public.orders o
    where o.id = new.order_id;

    update public.orders
    set accepted_at = coalesce(accepted_at, new.accepted_at, now())
    where id = new.order_id
      and channel = 'comanda';

    if v_visit_id is not null then
      update public.table_visits
      set status = 'ocupado',
          occupied_at = coalesce(occupied_at, new.accepted_at, now())
      where id = v_visit_id
        and status = 'aberto';

      get diagnostics v_updated = row_count;

      if v_updated > 0 then
        insert into public.audit_logs (
          actor_kind, action, entity_type, entity_id, metadata
        ) values (
          'system',
          'table_visit.occupied',
          'table_visit',
          v_visit_id::text,
          jsonb_build_object(
            'order_id', new.order_id,
            'request_id', new.id,
            'table_id', new.table_id
          )
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists command_requests_mark_table_visit_occupied on public.command_requests;
create trigger command_requests_mark_table_visit_occupied
after update of status on public.command_requests
for each row execute function public.mark_table_visit_occupied_on_request_accept();

revoke execute on function public.mark_table_visit_occupied_on_request_accept()
  from public, anon, authenticated;

create or replace function public.sync_table_visit_on_command_finish()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_visit public.table_visits;
begin
  if new.channel <> 'comanda'
     or new.table_visit_id is null
     or new.status not in ('concluido', 'cancelado')
     or old.status is not distinct from new.status then
    return new;
  end if;

  select * into v_visit
  from public.table_visits
  where id = new.table_visit_id
  for update;

  if v_visit.id is null or v_visit.status = 'encerrado' then
    return new;
  end if;

  if exists (
    select 1
    from public.orders o
    where o.table_visit_id = v_visit.id
      and o.channel = 'comanda'
      and o.status = 'aberto'
      and (
        o.accepted_at is not null
        or exists (
          select 1
          from public.command_requests cr
          where cr.order_id = o.id
            and cr.status = 'pendente'
        )
      )
  ) then
    return new;
  end if;

  update public.table_visits
  set status = 'encerrado',
      closed_at = coalesce(closed_at, now())
  where id = v_visit.id
    and status <> 'encerrado';

  -- Sessões que só escanearam o QR, mas nunca tiveram consumo aprovado,
  -- não podem manter a mesa artificialmente ocupada.
  update public.orders
  set status = 'cancelado',
      payment_status = 'cancelado',
      canceled_at = coalesce(canceled_at, now()),
      cancellation_reason = coalesce(
        cancellation_reason,
        'Atendimento da mesa encerrado sem consumo confirmado'
      )
  where table_visit_id = v_visit.id
    and channel = 'comanda'
    and status = 'aberto';

  update public.command_customer_sessions s
  set status = 'encerrado',
      closed_at = coalesce(closed_at, now()),
      last_seen_at = now()
  where s.status = 'ativo'
    and exists (
      select 1
      from public.orders o
      where o.id = s.order_id
        and o.table_visit_id = v_visit.id
    );

  insert into public.audit_logs (
    actor_kind, action, entity_type, entity_id, metadata
  ) values (
    'system',
    'table_visit.closed',
    'table_visit',
    v_visit.id::text,
    jsonb_build_object(
      'table_id', v_visit.table_id,
      'closed_by_order_id', new.id,
      'closed_by_order_number', new.order_number
    )
  );

  return new;
end;
$$;

drop trigger if exists orders_sync_table_visit_on_finish on public.orders;
create trigger orders_sync_table_visit_on_finish
after update of status on public.orders
for each row execute function public.sync_table_visit_on_command_finish();

revoke execute on function public.sync_table_visit_on_command_finish()
  from public, anon, authenticated;

create or replace function public.settle_command_from_external_pos(
  p_order_number bigint,
  p_operation_key text,
  p_external_reference text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.external_pos_settlements;
  v_order public.orders;
begin
  if p_order_number is null or p_order_number <= 0 then
    raise exception 'Numero de comanda invalido';
  end if;

  if nullif(trim(p_operation_key), '') is null
     or char_length(trim(p_operation_key)) not between 8 and 160 then
    raise exception 'Chave de operacao invalida';
  end if;

  select * into v_existing
  from public.external_pos_settlements
  where operation_key = trim(p_operation_key);

  if v_existing.id is not null then
    return jsonb_build_object(
      'settlement_id', v_existing.id,
      'order_id', v_existing.order_id,
      'order_number', v_existing.order_number,
      'already_processed', true
    );
  end if;

  select * into v_order
  from public.orders
  where order_number = p_order_number
    and channel = 'comanda'
  for update;

  if v_order.id is null then
    raise exception 'Comanda nao encontrada';
  end if;

  -- Revalida a idempotência após adquirir o lock da comanda.
  select * into v_existing
  from public.external_pos_settlements
  where operation_key = trim(p_operation_key);

  if v_existing.id is not null then
    return jsonb_build_object(
      'settlement_id', v_existing.id,
      'order_id', v_existing.order_id,
      'order_number', v_existing.order_number,
      'already_processed', true
    );
  end if;

  if v_order.status <> 'aberto' then
    raise exception 'Comanda nao esta aberta';
  end if;

  if exists (
    select 1
    from public.command_requests
    where order_id = v_order.id
      and status = 'pendente'
  ) then
    raise exception 'Comanda possui pedidos aguardando atendimento';
  end if;

  insert into public.external_pos_settlements (
    operation_key,
    provider,
    order_id,
    order_number,
    external_reference
  ) values (
    trim(p_operation_key),
    'gemaster',
    v_order.id,
    v_order.order_number,
    nullif(trim(p_external_reference), '')
  ) returning * into v_existing;

  update public.orders
  set status = 'concluido',
      payment_status = 'pago',
      closed_at = coalesce(closed_at, now()),
      payment_method = null
  where id = v_order.id
  returning * into v_order;

  insert into public.audit_logs (
    actor_kind, action, entity_type, entity_id, metadata
  ) values (
    'system',
    'command.closed_external_pos',
    'order',
    v_order.id::text,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'table_id', v_order.table_id,
      'table_visit_id', v_order.table_visit_id,
      'provider', 'gemaster',
      'operation_key', v_existing.operation_key,
      'external_reference', v_existing.external_reference
    )
  );

  return jsonb_build_object(
    'settlement_id', v_existing.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'table_id', v_order.table_id,
    'table_visit_id', v_order.table_visit_id,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'already_processed', false
  );
end;
$$;

revoke execute on function public.settle_command_from_external_pos(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_command_from_external_pos(bigint, text, text)
  to service_role;

comment on table public.table_visits is
  'Atendimento físico de uma mesa. Agrupa várias comandas individuais da mesma visita.';
comment on table public.external_pos_settlements is
  'Registro idempotente de baixas confirmadas por PDV externo. O Bridge deve chamar o backend, nunca usar service_role diretamente.';
comment on function public.settle_command_from_external_pos(bigint, text, text) is
  'Fecha uma comanda após confirmação de pagamento em PDV externo, com chave idempotente.';
