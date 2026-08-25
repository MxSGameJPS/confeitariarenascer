create or replace function public.broadcast_order_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
begin
  v_channel := case when tg_op = 'DELETE' then old.channel else new.channel end;
  if v_channel in ('delivery', 'comanda') then
    perform realtime.send(
      jsonb_build_object('source', 'orders', 'operation', tg_op),
      'refresh', 'renascer:' || v_channel, false
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.broadcast_command_request_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('source', 'command_requests', 'operation', tg_op),
    'refresh', 'renascer:comanda', false
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.broadcast_order_item_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_order_id uuid;
begin
  v_order_id := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  select channel into v_channel from public.orders where id = v_order_id;
  if v_channel in ('delivery', 'comanda') then
    perform realtime.send(
      jsonb_build_object('source', 'order_items', 'operation', tg_op),
      'refresh', 'renascer:' || v_channel, false
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger orders_broadcast_operation
after insert or update or delete on public.orders
for each row execute function public.broadcast_order_operation();

create trigger command_requests_broadcast_operation
after insert or update or delete on public.command_requests
for each row execute function public.broadcast_command_request_operation();

create trigger order_items_broadcast_operation
after insert or update or delete on public.order_items
for each row execute function public.broadcast_order_item_operation();

revoke execute on function public.broadcast_order_operation() from public, anon, authenticated;
revoke execute on function public.broadcast_command_request_operation() from public, anon, authenticated;
revoke execute on function public.broadcast_order_item_operation() from public, anon, authenticated;

comment on function public.broadcast_order_operation() is
  'Emite somente sinais de atualização pelo Supabase Realtime; dados continuam protegidos nas APIs.';
