-- Comandas fisicas de balcao (ex.: C105) podem ser reutilizadas depois do fechamento,
-- mas somente uma C105 pode permanecer aberta por vez.
-- order_number continua sendo o identificador interno unico da venda.

create unique index if not exists orders_open_physical_command_code_unique_idx
  on public.orders ((upper(btrim(command_label))))
  where channel = 'comanda'
    and status = 'aberto'
    and command_label is not null
    and upper(btrim(command_label)) ~ '^C[0-9]+$';

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
  v_normalized_label text;
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

  v_normalized_label := upper(btrim(v_label));

  if v_normalized_label ~ '^C[0-9]+$' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('renascer:physical-command:' || v_normalized_label, 0)
    );

    select * into v_order
    from public.orders
    where channel = 'comanda'
      and status = 'aberto'
      and upper(btrim(command_label)) = v_normalized_label
    order by created_at desc
    limit 1
    for update;

    if v_order.id is not null then
      return jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'command_label', v_order.command_label,
        'status', v_order.status,
        'total', v_order.total,
        'table_id', v_order.table_id,
        'table_visit_id', v_order.table_visit_id,
        'duplicate', true,
        'created_at', v_order.created_at
      );
    end if;

    v_label := v_normalized_label;
  end if;

  select * into v_order
  from public.orders
  where counter_open_operation_key = p_operation_key
  limit 1;

  if v_order.id is not null then
    if v_order.channel <> 'comanda' or upper(btrim(v_order.command_label)) <> upper(btrim(v_label)) then
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

      if v_order.id is null and v_normalized_label ~ '^C[0-9]+$' then
        select * into v_order
        from public.orders
        where channel = 'comanda'
          and status = 'aberto'
          and upper(btrim(command_label)) = v_normalized_label
        order by created_at desc
        limit 1;
      end if;

      if v_order.id is null or v_order.channel <> 'comanda' or upper(btrim(v_order.command_label)) <> upper(btrim(v_label)) then
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
          'location', 'counter',
          'physical_command', v_normalized_label ~ '^C[0-9]+$'
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

revoke execute on function public.open_counter_command_transaction(text, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.open_counter_command_transaction(text, uuid, text, uuid)
  to service_role;

comment on index public.orders_open_physical_command_code_unique_idx is
  'Garante uma unica comanda fisica C### aberta por vez; o codigo pode ser reutilizado apos fechamento.';

comment on function public.open_counter_command_transaction(text, uuid, text, uuid) is
  'Abre comanda de balcao de forma idempotente; codigos fisicos C### reaproveitam a instancia aberta e podem ser reutilizados apos fechamento.';
