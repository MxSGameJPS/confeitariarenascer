-- Comandas abertas pelo atendente no balcão podem existir sem mesa e ser vinculadas depois.
-- Abertura e vínculo são idempotentes e auditados; mesa/visita são protegidas por lock.

alter table public.orders
  add column if not exists counter_open_operation_key uuid;

create unique index if not exists orders_counter_open_operation_key_idx
  on public.orders(counter_open_operation_key);

create table if not exists public.command_table_links (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  table_visit_id uuid not null references public.table_visits(id) on delete restrict,
  actor_employee_id uuid references public.employees(id) on delete set null,
  actor_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint command_table_links_actor_check check (
    not (actor_employee_id is not null and actor_admin_id is not null)
  )
);

create unique index if not exists command_table_links_order_unique_idx
  on public.command_table_links(order_id);
create index if not exists command_table_links_table_idx
  on public.command_table_links(table_id, created_at desc);

alter table public.command_table_links enable row level security;
revoke all on table public.command_table_links from public, anon, authenticated;
grant all on table public.command_table_links to service_role;

create or replace function public.open_counter_command_transaction(
  p_command_label text,
  p_operation_key uuid,
  p_actor_kind text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_label text := trim(p_command_label);
  v_order public.orders;
  v_duplicate boolean := false;
begin
  if p_operation_key is null then
    raise exception 'OperationId obrigatorio';
  end if;
  if p_actor_kind not in ('admin', 'employee') or p_actor_id is null then
    raise exception 'Operador invalido';
  end if;
  if v_label is null or char_length(v_label) not between 2 and 80 then
    raise exception 'Identificacao da comanda invalida';
  end if;

  select * into v_order
  from public.orders
  where counter_open_operation_key = p_operation_key
  limit 1;

  if v_order.id is not null then
    if v_order.channel <> 'comanda' or v_order.command_label <> v_label then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;
    v_duplicate := true;
  else
    begin
      insert into public.orders (
        status,
        channel,
        fulfillment_type,
        payment_status,
        subtotal,
        delivery_fee,
        total,
        command_label,
        accepted_at,
        responsible_employee_id,
        responsible_admin_id,
        counter_open_operation_key
      ) values (
        'aberto',
        'comanda',
        'local',
        'pendente',
        0,
        0,
        0,
        v_label,
        now(),
        case when p_actor_kind = 'employee' then p_actor_id end,
        case when p_actor_kind = 'admin' then p_actor_id end,
        p_operation_key
      ) returning * into v_order;
    exception when unique_violation then
      select * into v_order
      from public.orders
      where counter_open_operation_key = p_operation_key
      limit 1;
      if v_order.id is null or v_order.channel <> 'comanda' or v_order.command_label <> v_label then
        raise;
      end if;
      v_duplicate := true;
    end;

    if not v_duplicate then
      insert into public.audit_logs (
        actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata
      ) values (
        case when p_actor_kind = 'admin' then p_actor_id end,
        case when p_actor_kind = 'employee' then p_actor_id end,
        p_actor_kind,
        'command.opened_at_counter',
        'order',
        v_order.id::text,
        jsonb_build_object(
          'order_number', v_order.order_number,
          'command_label', v_order.command_label,
          'location', 'counter'
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'command_label', v_order.command_label,
    'status', v_order.status,
    'total', v_order.total,
    'table_id', v_order.table_id,
    'table_visit_id', v_order.table_visit_id,
    'duplicate', v_duplicate,
    'created_at', v_order.created_at
  );
end;
$$;

create or replace function public.link_command_to_table_transaction(
  p_order_id uuid,
  p_table_id uuid,
  p_operation_key uuid,
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
  v_table public.dining_tables;
  v_visit public.table_visits;
  v_existing public.command_table_links;
  v_link public.command_table_links;
begin
  if p_operation_key is null then
    raise exception 'OperationId obrigatorio';
  end if;
  if p_actor_kind not in ('admin', 'employee') or p_actor_id is null then
    raise exception 'Operador invalido';
  end if;

  select * into v_existing
  from public.command_table_links
  where operation_key = p_operation_key
  limit 1;

  if v_existing.id is not null then
    if v_existing.order_id <> p_order_id or v_existing.table_id <> p_table_id then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;
    select * into v_order from public.orders where id = p_order_id;
    select * into v_table from public.dining_tables where id = p_table_id;
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'command_label', v_order.command_label,
      'table_id', v_table.id,
      'table_number', v_table.table_number,
      'table_visit_id', v_existing.table_visit_id,
      'duplicate', true
    );
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and channel = 'comanda'
    and status = 'aberto'
  for update;

  if v_order.id is null then
    raise exception 'Comanda nao encontrada ou encerrada';
  end if;

  if v_order.table_id is not null then
    if v_order.table_id = p_table_id then
      select * into v_table from public.dining_tables where id = p_table_id;
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'command_label', v_order.command_label,
        'table_id', v_order.table_id,
        'table_number', v_table.table_number,
        'table_visit_id', v_order.table_visit_id,
        'duplicate', true
      );
    end if;
    raise exception 'Comanda ja vinculada a outra mesa';
  end if;

  select * into v_table
  from public.dining_tables
  where id = p_table_id
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
    insert into public.table_visits (table_id, status, occupied_at)
    values (v_table.id, 'ocupado', now())
    returning * into v_visit;

    insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
    values (
      case when p_actor_kind = 'admin' then p_actor_id end,
      case when p_actor_kind = 'employee' then p_actor_id end,
      p_actor_kind,
      'table_visit.opened_by_command_link',
      'table_visit',
      v_visit.id::text,
      jsonb_build_object('table_id', v_table.id, 'table_number', v_table.table_number)
    );
  elsif v_visit.status = 'aberto' then
    update public.table_visits
    set status = 'ocupado', occupied_at = coalesce(occupied_at, now())
    where id = v_visit.id
    returning * into v_visit;
  end if;

  update public.orders
  set table_id = v_table.id,
      table_visit_id = v_visit.id
  where id = v_order.id
  returning * into v_order;

  insert into public.command_table_links (
    operation_key, order_id, table_id, table_visit_id, actor_employee_id, actor_admin_id
  ) values (
    p_operation_key,
    v_order.id,
    v_table.id,
    v_visit.id,
    case when p_actor_kind = 'employee' then p_actor_id end,
    case when p_actor_kind = 'admin' then p_actor_id end
  ) returning * into v_link;

  insert into public.audit_logs (
    actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind,
    'command.linked_to_table',
    'order',
    v_order.id::text,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'command_label', v_order.command_label,
      'table_id', v_table.id,
      'table_number', v_table.table_number,
      'table_visit_id', v_visit.id,
      'link_id', v_link.id
    )
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'command_label', v_order.command_label,
    'table_id', v_table.id,
    'table_number', v_table.table_number,
    'table_visit_id', v_visit.id,
    'duplicate', false
  );
end;
$$;

revoke execute on function public.open_counter_command_transaction(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.open_counter_command_transaction(text, uuid, text, uuid)
  to service_role;

revoke execute on function public.link_command_to_table_transaction(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.link_command_to_table_transaction(uuid, uuid, uuid, text, uuid)
  to service_role;

comment on table public.command_table_links is
  'Historico idempotente do primeiro vinculo de uma comanda de balcao a uma mesa.';
comment on function public.open_counter_command_transaction(text, uuid, text, uuid) is
  'Abre comanda operacional sem mesa, pronta para receber itens e ser vinculada depois.';
comment on function public.link_command_to_table_transaction(uuid, uuid, uuid, text, uuid) is
  'Vincula comanda aberta sem mesa a uma mesa, criando/reutilizando a visita ativa com lock.';
