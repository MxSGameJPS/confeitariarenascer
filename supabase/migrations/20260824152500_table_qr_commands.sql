alter table public.products
  add column pricing_mode text not null default 'fixed',
  add constraint products_pricing_mode_check check (pricing_mode in ('fixed', 'variable'));

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null unique check (table_number > 0),
  seats integer not null check (seats between 1 and 50),
  public_token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  command_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column table_id uuid references public.dining_tables(id) on delete restrict;

create unique index orders_open_table_command_unique_idx
  on public.orders(table_id)
  where table_id is not null and channel = 'comanda' and status = 'aberto';

create table public.command_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_name text,
  notes text,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado')),
  accepted_by_employee_id uuid references public.employees(id) on delete set null,
  accepted_by_admin_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint command_requests_actor_check check (
    not (accepted_by_employee_id is not null and accepted_by_admin_id is not null)
  )
);

alter table public.order_items
  add column request_id uuid references public.command_requests(id) on delete set null,
  add column pricing_mode text not null default 'fixed',
  add column service_status text not null default 'aceito',
  add constraint order_items_pricing_mode_check check (pricing_mode in ('fixed', 'variable')),
  add constraint order_items_service_status_check check (service_status in ('pendente', 'aceito', 'cancelado'));

create index dining_tables_status_idx on public.dining_tables(active, command_enabled, table_number);
create index command_requests_status_created_idx on public.command_requests(status, created_at);
create index command_requests_order_idx on public.command_requests(order_id, created_at);
create index order_items_request_idx on public.order_items(request_id);

alter table public.dining_tables enable row level security;
alter table public.command_requests enable row level security;
revoke all on table public.dining_tables, public.command_requests from public, anon, authenticated;
grant all on table public.dining_tables, public.command_requests to service_role;

drop trigger if exists dining_tables_set_updated_at on public.dining_tables;
create trigger dining_tables_set_updated_at
before update on public.dining_tables
for each row execute function public.set_updated_at();

create or replace function public.guard_command_close_with_pending_requests()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.channel = 'comanda' and new.status = 'concluido' and old.status is distinct from new.status
    and exists (select 1 from public.command_requests where order_id = new.id and status = 'pendente') then
    raise exception 'Existem pedidos da mesa aguardando atendimento';
  end if;
  return new;
end;
$$;

create trigger orders_guard_pending_command_requests
before update of status on public.orders
for each row execute function public.guard_command_close_with_pending_requests();

revoke execute on function public.guard_command_close_with_pending_requests() from public, anon, authenticated;

create or replace function public.create_table_command_request(
  p_table_token uuid,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_table public.dining_tables;
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

  if exists (
    select 1 from public.command_requests
    where table_id = v_table.id and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outro pedido';
  end if;

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

  insert into public.command_requests (table_id, order_id, customer_name, notes)
  values (v_table.id, v_order.id, nullif(trim(p_customer_name), ''), nullif(trim(p_notes), ''))
  returning * into v_request;

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
      'order_id', v_order.id, 'order_number', v_order.order_number));

  return jsonb_build_object(
    'request_id', v_request.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'table_number', v_table.table_number,
    'status', v_request.status,
    'created_at', v_request.created_at
  );
end;
$$;

create or replace function public.accept_command_request_transaction(
  p_request_id uuid,
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
  v_request public.command_requests;
  v_item public.order_items;
  v_price numeric(12, 2);
  v_subtotal numeric(12, 2);
begin
  select * into v_request from public.command_requests
  where id = p_request_id and status = 'pendente' for update;
  if v_request.id is null then raise exception 'Solicitacao nao esta pendente'; end if;

  for v_item in select * from public.order_items where request_id = v_request.id and status = 'ativo' for update
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

  update public.order_items set service_status = 'aceito' where request_id = v_request.id;
  update public.command_requests set status = 'aceito', accepted_at = now(),
    accepted_by_employee_id = case when p_actor_kind = 'employee' then p_actor_id end,
    accepted_by_admin_id = case when p_actor_kind = 'admin' then p_actor_id end
  where id = v_request.id returning * into v_request;

  select coalesce(sum(subtotal), 0) into v_subtotal from public.order_items
  where order_id = v_request.order_id and status = 'ativo';
  update public.orders set subtotal = v_subtotal, total = v_subtotal + delivery_fee
  where id = v_request.order_id;

  insert into public.audit_logs (actor_id, actor_employee_id, actor_kind, action, entity_type, entity_id, metadata)
  values (case when p_actor_kind = 'admin' then p_actor_id end,
    case when p_actor_kind = 'employee' then p_actor_id end,
    p_actor_kind, 'command.request_accepted', 'command_request', v_request.id::text,
    jsonb_build_object('order_id', v_request.order_id, 'table_id', v_request.table_id));

  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.create_table_command_request(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.accept_command_request_transaction(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.create_table_command_request(uuid, text, text, jsonb) to service_role;
grant execute on function public.accept_command_request_transaction(uuid, jsonb, text, uuid) to service_role;

comment on table public.dining_tables is 'Mesas fisicas com token publico aleatorio usado nos QR Codes.';
comment on table public.command_requests is 'Lotes de itens enviados por clientes para uma comanda de mesa.';
