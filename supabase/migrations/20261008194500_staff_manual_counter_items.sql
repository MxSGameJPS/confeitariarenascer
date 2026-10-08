-- Produtos personalizados: valor informado na estação, validado e auditado no PostgreSQL.
-- Não altera as regras de preços por kg ou por unidade.
create or replace function public.register_staff_manual_counter_item_transaction(
  p_order_number bigint,
  p_product_id uuid,
  p_manual_amount numeric,
  p_operation_key uuid,
  p_employee_id uuid
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_employee public.employees;
  v_order public.orders;
  v_product public.products;
  v_item public.order_items;
  v_total numeric(12,2);
begin
  if p_order_number is null or p_order_number <= 0 then
    raise exception 'Numero da comanda invalido';
  end if;
  if p_product_id is null or p_operation_key is null or p_employee_id is null then
    raise exception 'Dados obrigatorios ausentes';
  end if;
  if p_manual_amount is null or p_manual_amount <= 0 or p_manual_amount > 10000
    or p_manual_amount <> round(p_manual_amount, 2) then
    raise exception 'Valor personalizado invalido';
  end if;

  select * into v_employee from public.employees
    where id=p_employee_id and active for share;
  if v_employee.id is null then raise exception 'Funcionario invalido'; end if;

  select * into v_item from public.order_items
    where counter_employee_id=p_employee_id and counter_operation_key=p_operation_key;
  if v_item.id is not null then
    if v_item.product_id<>p_product_id or v_item.unit_price<>p_manual_amount
       or v_item.quantity<>1 or not exists (
         select 1 from public.orders
         where id=v_item.order_id and order_number=p_order_number
       ) then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;
    select total into v_total from public.orders where id=v_item.order_id;
    return jsonb_build_object('duplicate',true,'item_id',v_item.id,
       'product_id',v_item.product_id,'product_name',v_item.product_name,
       'pricing_mode','manual','quantity',1,'unit_price',v_item.unit_price,
       'item_total',v_item.subtotal,'order_total',v_total);
  end if;

  select * into v_order from public.orders
    where order_number=p_order_number and channel='comanda' and status='aberto'
    for update;
  if v_order.id is null then raise exception 'Comanda nao encontrada ou encerrada'; end if;

  select * into v_product from public.products
    where id=p_product_id and active and available_internal
    and exists (select 1 from public.operational_product_codes c
      where c.product_id=public.products.id and c.sale_type='custom')
    for share;
  if v_product.id is null then
    raise exception 'Produto nao permite valor personalizado';
  end if;

  insert into public.order_items (
    order_id,product_id,product_name,unit_price,quantity,subtotal,
    pricing_mode,service_status,counter_operation_key,counter_employee_id
  ) values (
    v_order.id,v_product.id,v_product.name,p_manual_amount,1,p_manual_amount,
    'fixed','aceito',p_operation_key,p_employee_id
  ) on conflict do nothing returning * into v_item;

  if v_item.id is null then
    select * into v_item from public.order_items
      where counter_employee_id=p_employee_id and counter_operation_key=p_operation_key;
    if v_item.id is null or v_item.product_id<>p_product_id or
      v_item.order_id<>v_order.id or v_item.unit_price<>p_manual_amount then
      raise exception 'OperationId reutilizado com dados diferentes';
    end if;
    return jsonb_build_object('duplicate',true,'item_id',v_item.id,
      'product_id',v_item.product_id,'product_name',v_item.product_name,
      'pricing_mode','manual','quantity',1,'unit_price',v_item.unit_price,
      'item_total',v_item.subtotal,'order_total',v_order.total);
  end if;

  select coalesce(sum(subtotal),0) into v_total
    from public.order_items where order_id=v_order.id and status='ativo';
  update public.orders set subtotal=v_total,total=v_total+delivery_fee,
    responsible_employee_id=p_employee_id
    where id=v_order.id returning total into v_total;

  insert into public.audit_logs(actor_employee_id,actor_kind,action,entity_type,entity_id,metadata)
  values(p_employee_id,'employee','counter.manual_item_added','order_item',v_item.id::text,
    jsonb_build_object('source','weighing_pwa','employee_id',p_employee_id,
      'order_number',p_order_number,'product_id',p_product_id,
      'product_name',v_product.name,'manual_amount',p_manual_amount,
      'operation_key',p_operation_key));

  return jsonb_build_object('duplicate',false,'item_id',v_item.id,
    'product_id',v_product.id,'product_name',v_product.name,
    'pricing_mode','manual','quantity',1,'unit_price',p_manual_amount,
    'item_total',p_manual_amount,'order_total',v_total);
end;
$$;

revoke execute on function public.register_staff_manual_counter_item_transaction(bigint,uuid,numeric,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.register_staff_manual_counter_item_transaction(bigint,uuid,numeric,uuid,uuid)
  to service_role;
update public.products p set available_internal=true,active=true
where exists (select 1 from public.operational_product_codes c
  where c.product_id=p.id and c.sale_type='custom');
