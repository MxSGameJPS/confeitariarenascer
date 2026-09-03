-- Consolida a resolução de C### para o Bridge depois da introdução de comandas físicas.
-- Usa command_label como autoridade para cartões físicos e preserva somente o
-- fallback legado por order_number para comandas antigas sem C### em command_label.

create or replace function public.prepare_gemaster_bridge_dispatch(
  p_reference_code text,
  p_operation_key uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_reference_code));
  v_device public.bridge_devices;
  v_order public.orders;
  v_existing public.bridge_dispatches;
  v_dispatch_id uuid := gen_random_uuid();
  v_reference_type text;
  v_item public.order_items;
  v_mapping public.product_external_mappings;
  v_items jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_item_count integer := 0;
  v_command_code text;
begin
  if p_device_id is null then raise exception 'Bridge obrigatorio'; end if;
  if p_operation_key is null then raise exception 'OperationId obrigatorio'; end if;
  if v_code is null or v_code = '' then raise exception 'Codigo obrigatorio'; end if;

  select * into v_device
  from public.bridge_devices
  where id = p_device_id and active
  for update;
  if v_device.id is null then raise exception 'Bridge inativo ou inexistente'; end if;

  select * into v_existing
  from public.bridge_dispatches
  where device_id = p_device_id and operation_key = p_operation_key;

  if v_existing.id is not null then
    if v_existing.reference_code <> v_code then
      raise exception 'OperationId reutilizado com codigo diferente';
    end if;
    return v_existing.response_payload || jsonb_build_object(
      'duplicate', true,
      'dispatch_status', v_existing.status,
      'settlement_id', v_existing.settlement_id,
      'settled_at', v_existing.settled_at
    );
  end if;

  if v_code ~ '^C[1-9][0-9]{0,11}$' then
    v_reference_type := 'comanda';

    select * into v_order
    from public.orders
    where channel = 'comanda'
      and status = 'aberto'
      and upper(btrim(command_label)) = v_code
    order by created_at desc
    limit 1
    for update;

    if v_order.id is null then
      select * into v_order
      from public.orders
      where channel = 'comanda'
        and order_number = substr(v_code, 2)::bigint
        and status = 'aberto'
        and (
          command_label is null
          or upper(btrim(command_label)) !~ '^C[0-9]+$'
        )
      for update;
    end if;

    if v_order.id is null then raise exception 'Comanda nao encontrada ou encerrada'; end if;

    if exists (
      select 1
      from public.command_requests
      where order_id = v_order.id and status = 'pendente'
    ) then
      raise exception 'Comanda possui solicitacoes pendentes';
    end if;

    v_command_code := case
      when upper(btrim(v_order.command_label)) ~ '^C[0-9]+$'
        then upper(btrim(v_order.command_label))
      else 'C' || v_order.order_number::text
    end;
  elsif v_code ~ '^DV[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    v_reference_type := 'delivery';
    select * into v_order
    from public.orders
    where channel = 'delivery'
      and delivery_code = v_code
      and status in ('confirmado', 'em_preparo', 'pronto', 'saiu_entrega')
    for update;
    if v_order.id is null then raise exception 'Delivery nao encontrado ou ainda nao aceito'; end if;
  else
    raise exception 'Codigo nao pertence ao Renascer';
  end if;

  if exists (
    select 1
    from public.order_items
    where order_id = v_order.id
      and status = 'ativo'
      and service_status <> 'aceito'
  ) then
    raise exception 'Pedido possui itens ainda nao aceitos';
  end if;

  for v_item in
    select *
    from public.order_items
    where order_id = v_order.id and status = 'ativo'
    order by created_at, id
  loop
    v_item_count := v_item_count + 1;

    if v_item.product_id is null then
      raise exception 'Item sem produto vinculado: %', v_item.product_name;
    end if;

    select * into v_mapping
    from public.product_external_mappings m
    where m.provider = 'gemaster'
      and m.product_id = v_item.product_id
      and m.active
      and (m.organization_id is null or m.organization_id = v_device.organization_id)
      and (m.store_id is null or m.store_id = v_device.store_id)
    order by (m.store_id is not null) desc, (m.organization_id is not null) desc
    limit 1;

    if v_mapping.id is null then
      raise exception 'Produto sem mapeamento GeMaster: %', v_item.product_name;
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'external_code', v_mapping.external_code,
      'external_reference', v_mapping.external_reference,
      'external_ean', v_mapping.external_ean,
      'quantity', v_item.quantity,
      'unit_price', v_item.unit_price,
      'subtotal', v_item.subtotal,
      'pricing_mode', v_item.pricing_mode,
      'weight_kg', v_item.weight_kg,
      'price_per_kg', v_item.price_per_kg,
      'requires_weight_handling', (v_item.pricing_mode = 'variable'),
      'mapping_id', v_mapping.id
    ));
  end loop;

  if v_item_count = 0 then raise exception 'Pedido sem itens ativos'; end if;

  v_payload := jsonb_build_object(
    'duplicate', false,
    'dispatch_id', v_dispatch_id,
    'dispatch_status', 'prepared',
    'provider', 'gemaster',
    'reference_code', v_code,
    'reference_type', v_reference_type,
    'command_code', v_command_code,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'order_status', v_order.status,
    'payment_status', v_order.payment_status,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'command_label', v_order.command_label,
    'items', v_items
  );

  insert into public.bridge_dispatches (
    id,
    device_id,
    operation_key,
    order_id,
    reference_code,
    reference_type,
    status,
    response_payload
  ) values (
    v_dispatch_id,
    p_device_id,
    p_operation_key,
    v_order.id,
    v_code,
    v_reference_type,
    'prepared',
    v_payload
  );

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values (
    'system',
    'bridge.dispatch_prepared',
    'bridge_dispatch',
    v_dispatch_id::text,
    jsonb_build_object(
      'device_id', v_device.id,
      'device_name', v_device.name,
      'reference_code', v_code,
      'command_code', v_command_code,
      'reference_type', v_reference_type,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'item_count', v_item_count
    )
  );

  return v_payload;
end;
$$;
