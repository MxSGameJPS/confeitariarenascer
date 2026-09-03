-- Confirmação segura de recebimento GeMaster via Bridge e busca operacional enxuta.
-- A leitura/injeção da comanda NÃO representa pagamento. Somente a confirmação
-- de venda concluída no GeMaster pode dar baixa no Renascer.

alter table public.external_pos_settlements
  add column if not exists device_id uuid references public.bridge_devices(id) on delete set null,
  add column if not exists dispatch_id uuid references public.bridge_dispatches(id) on delete set null,
  add column if not exists store_id uuid,
  add column if not exists external_total numeric(12, 2),
  add column if not exists payment_method text,
  add column if not exists fiscal_document text,
  add column if not exists completed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.external_pos_settlements
  drop constraint if exists external_pos_settlements_external_total_check,
  add constraint external_pos_settlements_external_total_check
    check (external_total is null or external_total >= 0),
  drop constraint if exists external_pos_settlements_payment_method_check,
  add constraint external_pos_settlements_payment_method_check
    check (payment_method is null or payment_method in ('dinheiro', 'pix', 'credito', 'debito'));

create unique index if not exists external_pos_settlements_provider_store_reference_unique_idx
  on public.external_pos_settlements (
    provider,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_reference
  )
  where external_reference is not null;

create index if not exists external_pos_settlements_dispatch_idx
  on public.external_pos_settlements(dispatch_id, created_at desc)
  where dispatch_id is not null;

alter table public.bridge_dispatches
  add column if not exists settlement_id uuid references public.external_pos_settlements(id) on delete set null,
  add column if not exists external_sale_id text,
  add column if not exists settled_at timestamptz;

alter table public.bridge_dispatches
  drop constraint if exists bridge_dispatches_status_check,
  add constraint bridge_dispatches_status_check
    check (status in ('prepared', 'injected', 'settled', 'failed'));

create index if not exists bridge_dispatches_settlement_idx
  on public.bridge_dispatches(settlement_id)
  where settlement_id is not null;

alter table public.financial_transactions
  add column if not exists external_settlement_id uuid
    references public.external_pos_settlements(id) on delete set null;

create unique index if not exists financial_transactions_external_settlement_unique_idx
  on public.financial_transactions(external_settlement_id)
  where external_settlement_id is not null and type = 'entrada';

create index if not exists product_external_mappings_gemaster_reference_idx
  on public.product_external_mappings(external_reference)
  where provider = 'gemaster' and active and external_reference is not null;

create index if not exists product_external_mappings_gemaster_ean_idx
  on public.product_external_mappings(external_ean)
  where provider = 'gemaster' and active and external_ean is not null;

-- Busca usada somente pelas telas operacionais. Não envia milhares de produtos
-- ao navegador: o banco retorna no máximo 30 candidatos após o operador digitar.
create or replace function public.search_operational_products(
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  price numeric,
  pricing_mode text,
  unit text,
  image_path text,
  external_code text,
  external_reference text,
  external_ean text,
  match_type text,
  match_rank integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_query_name text;
  v_padded_reference text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if v_query = '' or char_length(v_query) > 80 then
    raise exception 'Busca de produto invalida';
  end if;

  v_query_name := pg_catalog.translate(
    pg_catalog.lower(v_query),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );

  if v_query ~ '^[0-9]+$' and char_length(v_query) < 6 then
    v_padded_reference := pg_catalog.lpad(
      coalesce(nullif(pg_catalog.ltrim(v_query, '0'), ''), '0'),
      6,
      '0'
    );
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.name,
      p.price,
      p.pricing_mode,
      p.unit,
      p.image_path,
      m.external_code,
      m.external_reference,
      m.external_ean,
      case
        when m.external_code = v_query then 'gemaster_code'
        when m.external_reference = v_query then 'reference'
        when v_padded_reference is not null and m.external_reference = v_padded_reference then 'reference'
        when m.external_ean = v_query then 'ean'
        when pg_catalog.translate(
          pg_catalog.lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) = v_query_name then 'name'
        when pg_catalog.translate(
          pg_catalog.lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) like v_query_name || '%' then 'name'
        else 'name'
      end as match_type,
      case
        when m.external_code = v_query then 0
        when m.external_reference = v_query then 1
        when v_padded_reference is not null and m.external_reference = v_padded_reference then 2
        when m.external_ean = v_query then 3
        when pg_catalog.translate(
          pg_catalog.lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) = v_query_name then 10
        when pg_catalog.translate(
          pg_catalog.lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) like v_query_name || '%' then 20
        else 30
      end as match_rank,
      pg_catalog.row_number() over (
        partition by p.id
        order by
          case
            when m.external_code = v_query then 0
            when m.external_reference = v_query then 1
            when v_padded_reference is not null and m.external_reference = v_padded_reference then 2
            when m.external_ean = v_query then 3
            else 10
          end,
          (m.store_id is not null) desc,
          (m.organization_id is not null) desc,
          m.created_at desc nulls last
      ) as product_row
    from public.products p
    left join public.product_external_mappings m
      on m.product_id = p.id
     and m.provider = 'gemaster'
     and m.active
    where p.active
      and p.available_internal
      and p.price_configured
      and (
        m.external_code = v_query
        or m.external_reference = v_query
        or (v_padded_reference is not null and m.external_reference = v_padded_reference)
        or m.external_ean = v_query
        or pg_catalog.translate(
          pg_catalog.lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) like '%' || v_query_name || '%'
      )
  )
  select
    c.id,
    c.name,
    c.price,
    c.pricing_mode,
    c.unit,
    c.image_path,
    c.external_code,
    c.external_reference,
    c.external_ean,
    c.match_type,
    c.match_rank
  from candidates c
  where c.product_row = 1
  order by c.match_rank, c.name
  limit v_limit;
end;
$$;

revoke execute on function public.search_operational_products(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_operational_products(text, integer)
  to service_role;

-- Corrige a resolução da comanda no Bridge: C105 pode ser o cartão físico
-- reutilizável e não o order_number interno. Para comandas legadas sem código
-- físico, mantém o fallback C<order_number>.
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
  v_code text := pg_catalog.upper(pg_catalog.btrim(p_reference_code));
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

    -- Primeiro procura a comanda física C###.
    select * into v_order
    from public.orders
    where channel = 'comanda'
      and status = 'aberto'
      and pg_catalog.upper(pg_catalog.btrim(command_label)) = v_code
    order by created_at desc
    limit 1
    for update;

    -- Compatibilidade com comandas antigas em que C### era o order_number.
    if v_order.id is null then
      select * into v_order
      from public.orders
      where channel = 'comanda'
        and order_number = pg_catalog.substring(v_code from 2)::bigint
        and status = 'aberto'
        and (
          command_label is null
          or pg_catalog.upper(pg_catalog.btrim(command_label)) !~ '^C[0-9]+$'
        )
      for update;
    end if;

    if v_order.id is null then raise exception 'Comanda nao encontrada ou encerrada'; end if;

    if exists (
      select 1 from public.command_requests
      where order_id = v_order.id and status = 'pendente'
    ) then
      raise exception 'Comanda possui solicitacoes pendentes';
    end if;

    v_command_code := case
      when pg_catalog.upper(pg_catalog.btrim(v_order.command_label)) ~ '^C[0-9]+$'
        then pg_catalog.upper(pg_catalog.btrim(v_order.command_label))
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
    id, device_id, operation_key, order_id, reference_code, reference_type, status, response_payload
  ) values (
    v_dispatch_id, p_device_id, p_operation_key, v_order.id, v_code, v_reference_type, 'prepared', v_payload
  );

  insert into public.audit_logs (actor_kind, action, entity_type, entity_id, metadata)
  values (
    'system', 'bridge.dispatch_prepared', 'bridge_dispatch', v_dispatch_id::text,
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

-- Confirma pagamento somente após o Bridge detectar uma venda realmente concluída
-- no GeMaster. Revalida snapshot, total e estado atual antes de fechar.
create or replace function public.confirm_gemaster_bridge_settlement(
  p_dispatch_id uuid,
  p_device_id uuid,
  p_operation_key uuid,
  p_external_sale_id text,
  p_total numeric,
  p_payment_method text default null,
  p_fiscal_document text default null,
  p_completed_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_device public.bridge_devices;
  v_dispatch public.bridge_dispatches;
  v_order public.orders;
  v_existing public.external_pos_settlements;
  v_settlement_result jsonb;
  v_settlement_id uuid;
  v_snapshot_total numeric(12, 2);
  v_current_item_count integer;
  v_snapshot_item_count integer;
  v_table_visit_status text;
  v_occurrence timestamptz := coalesce(p_completed_at, now());
  v_store_scope uuid;
begin
  if p_dispatch_id is null or p_device_id is null or p_operation_key is null then
    raise exception 'Dados da liquidacao invalidos';
  end if;
  if nullif(pg_catalog.btrim(p_external_sale_id), '') is null
     or char_length(pg_catalog.btrim(p_external_sale_id)) > 120 then
    raise exception 'Identificacao da venda GeMaster invalida';
  end if;
  if p_total is null or p_total < 0 then
    raise exception 'Total da venda GeMaster invalido';
  end if;
  if p_payment_method is not null
     and p_payment_method not in ('dinheiro', 'pix', 'credito', 'debito') then
    raise exception 'Forma de pagamento GeMaster invalida';
  end if;
  if p_fiscal_document is not null and char_length(pg_catalog.btrim(p_fiscal_document)) > 120 then
    raise exception 'Documento fiscal GeMaster invalido';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
     or pg_catalog.octet_length(p_metadata::text) > 8192 then
    raise exception 'Metadados GeMaster invalidos';
  end if;

  select * into v_device
  from public.bridge_devices
  where id = p_device_id and active
  for update;
  if v_device.id is null then raise exception 'Bridge inativo ou inexistente'; end if;

  v_store_scope := v_device.store_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'renascer:gemaster-sale:' || coalesce(v_store_scope::text, 'global') || ':' || pg_catalog.btrim(p_external_sale_id),
      0
    )
  );

  select * into v_existing
  from public.external_pos_settlements s
  where s.provider = 'gemaster'
    and coalesce(s.store_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(v_store_scope, '00000000-0000-0000-0000-000000000000'::uuid)
    and s.external_reference = pg_catalog.btrim(p_external_sale_id)
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'settlement_id', v_existing.id,
      'order_id', v_existing.order_id,
      'order_number', v_existing.order_number,
      'external_sale_id', v_existing.external_reference,
      'already_processed', true
    );
  end if;

  select * into v_dispatch
  from public.bridge_dispatches
  where id = p_dispatch_id and device_id = p_device_id
  for update;
  if v_dispatch.id is null then raise exception 'Despacho do Bridge nao encontrado'; end if;
  if v_dispatch.reference_type <> 'comanda' then
    raise exception 'Liquidacao automatica suportada apenas para comanda';
  end if;
  if v_dispatch.status = 'prepared' then
    raise exception 'Venda ainda nao foi confirmada como injetada no GeMaster';
  end if;
  if v_dispatch.status = 'failed' then
    raise exception 'Despacho do Bridge falhou e nao pode ser liquidado';
  end if;
  if v_dispatch.status = 'settled' and v_dispatch.settlement_id is not null then
    select * into v_existing
    from public.external_pos_settlements
    where id = v_dispatch.settlement_id;
    return jsonb_build_object(
      'settlement_id', v_existing.id,
      'order_id', v_existing.order_id,
      'order_number', v_existing.order_number,
      'external_sale_id', v_existing.external_reference,
      'already_processed', true
    );
  end if;

  select * into v_order
  from public.orders
  where id = v_dispatch.order_id and channel = 'comanda'
  for update;
  if v_order.id is null then raise exception 'Comanda do despacho nao encontrada'; end if;
  if v_order.status <> 'aberto' then raise exception 'Comanda nao esta aberta para liquidacao'; end if;

  if exists (
    select 1 from public.command_requests
    where order_id = v_order.id and status = 'pendente'
  ) then
    raise exception 'Comanda possui pedidos aguardando atendimento';
  end if;

  if exists (
    select 1 from public.order_items
    where order_id = v_order.id
      and status = 'ativo'
      and service_status <> 'aceito'
  ) then
    raise exception 'Comanda possui itens ainda nao aceitos';
  end if;

  v_snapshot_total := (v_dispatch.response_payload->>'total')::numeric;
  if pg_catalog.abs(v_snapshot_total - v_order.total) > 0.01 then
    raise exception 'Comanda alterada apos envio ao GeMaster';
  end if;
  if pg_catalog.abs(p_total - v_order.total) > 0.01 then
    raise exception 'Total da venda GeMaster diverge da comanda';
  end if;

  select count(*) into v_current_item_count
  from public.order_items
  where order_id = v_order.id and status = 'ativo';
  v_snapshot_item_count := jsonb_array_length(v_dispatch.response_payload->'items');

  if v_current_item_count <> v_snapshot_item_count
     or exists (
       select 1
       from public.order_items oi
       where oi.order_id = v_order.id
         and oi.status = 'ativo'
         and not exists (
           select 1
           from jsonb_array_elements(v_dispatch.response_payload->'items') snapshot
           where snapshot->>'item_id' = oi.id::text
             and (snapshot->>'quantity')::integer = oi.quantity
             and pg_catalog.abs((snapshot->>'subtotal')::numeric - oi.subtotal) <= 0.01
         )
     ) then
    raise exception 'Itens da comanda mudaram apos envio ao GeMaster';
  end if;

  v_settlement_result := public.settle_command_from_external_pos(
    v_order.order_number,
    p_operation_key::text,
    pg_catalog.btrim(p_external_sale_id)
  );
  v_settlement_id := (v_settlement_result->>'settlement_id')::uuid;

  update public.external_pos_settlements
  set device_id = p_device_id,
      dispatch_id = p_dispatch_id,
      store_id = v_store_scope,
      external_total = p_total,
      payment_method = p_payment_method,
      fiscal_document = nullif(pg_catalog.btrim(p_fiscal_document), ''),
      completed_at = v_occurrence,
      metadata = p_metadata
  where id = v_settlement_id
  returning * into v_existing;

  update public.orders
  set payment_method = coalesce(p_payment_method, payment_method)
  where id = v_order.id;

  insert into public.financial_transactions (
    order_id,
    external_settlement_id,
    type,
    category,
    description,
    amount,
    payment_method,
    status,
    occurred_at
  ) values (
    v_order.id,
    v_settlement_id,
    'entrada',
    'venda',
    'Recebimento GeMaster da ' || coalesce(v_order.command_label, 'comanda #' || v_order.order_number::text),
    p_total,
    p_payment_method,
    'confirmado',
    v_occurrence
  ) on conflict (external_settlement_id) where external_settlement_id is not null and type = 'entrada'
    do nothing;

  update public.bridge_dispatches
  set status = 'settled',
      settlement_id = v_settlement_id,
      external_sale_id = pg_catalog.btrim(p_external_sale_id),
      settled_at = v_occurrence
  where id = v_dispatch.id
  returning * into v_dispatch;

  if v_order.table_visit_id is not null then
    select status into v_table_visit_status
    from public.table_visits
    where id = v_order.table_visit_id;
  end if;

  insert into public.audit_logs (
    actor_kind, action, entity_type, entity_id, metadata
  ) values (
    'system',
    'bridge.settlement_confirmed',
    'bridge_dispatch',
    v_dispatch.id::text,
    jsonb_build_object(
      'device_id', p_device_id,
      'settlement_id', v_settlement_id,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'command_label', v_order.command_label,
      'external_sale_id', v_existing.external_reference,
      'external_total', p_total,
      'payment_method', p_payment_method,
      'fiscal_document', v_existing.fiscal_document,
      'table_id', v_order.table_id,
      'table_visit_id', v_order.table_visit_id,
      'table_visit_status', v_table_visit_status
    )
  );

  return jsonb_build_object(
    'settlement_id', v_settlement_id,
    'dispatch_id', v_dispatch.id,
    'dispatch_status', v_dispatch.status,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'command_label', v_order.command_label,
    'external_sale_id', v_existing.external_reference,
    'external_total', v_existing.external_total,
    'payment_status', 'pago',
    'status', 'concluido',
    'table_id', v_order.table_id,
    'table_visit_id', v_order.table_visit_id,
    'table_visit_status', v_table_visit_status,
    'already_processed', false
  );
end;
$$;

revoke execute on function public.confirm_gemaster_bridge_settlement(
  uuid, uuid, uuid, text, numeric, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.confirm_gemaster_bridge_settlement(
  uuid, uuid, uuid, text, numeric, text, text, timestamptz, jsonb
) to service_role;

comment on function public.search_operational_products(text, integer) is
  'Busca enxuta de produtos internos por nome, codigo GeMaster, referencia ou EAN; usada por Caixa e Comandas.';
comment on function public.confirm_gemaster_bridge_settlement(uuid, uuid, uuid, text, numeric, text, text, timestamptz, jsonb) is
  'Confirma venda concluida no GeMaster, revalida snapshot/total, fecha a comanda, libera mesa quando aplicavel e registra financeiro/auditoria com idempotencia.';
comment on column public.bridge_dispatches.settled_at is
  'Momento em que o GeMaster confirmou a conclusao financeira; injected_at isoladamente nao fecha a comanda.';
