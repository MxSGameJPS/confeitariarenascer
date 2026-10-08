create table if not exists public.custom_product_variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 2 and 100),
 active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(product_id,name)
);
create index if not exists custom_product_variants_parent_idx on public.custom_product_variants(product_id,active,sort_order);
alter table public.custom_product_variants enable row level security;
revoke all on public.custom_product_variants from anon,authenticated;
grant all on public.custom_product_variants to service_role;

alter table public.order_items add column if not exists custom_variant_id uuid references public.custom_product_variants(id) on delete set null;
alter table public.order_items add column if not exists custom_variant_name text;

create or replace function public.register_staff_manual_counter_item_with_variant(
 p_order_number bigint, p_product_id uuid, p_manual_amount numeric,
 p_operation_key uuid, p_employee_id uuid, p_variant_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_variant public.custom_product_variants;
 v_result jsonb;
 v_item public.order_items;
 v_existing public.order_items;
 v_parent_name text;
begin
 if p_variant_id is not null then
   select * into v_variant from public.custom_product_variants
   where id=p_variant_id and product_id=p_product_id and active for share;
   if v_variant.id is null then raise exception 'Subproduto invalido para este produto'; end if;
 end if;
 select * into v_existing from public.order_items
 where counter_employee_id=p_employee_id and counter_operation_key=p_operation_key for update;
 if v_existing.id is not null and v_existing.custom_variant_id is distinct from p_variant_id then
   raise exception 'OperationId reutilizado com subproduto diferente';
 end if;
 v_result:=public.register_staff_manual_counter_item_transaction(
  p_order_number,p_product_id,p_manual_amount,p_operation_key,p_employee_id
 );
 select * into v_item from public.order_items where id=(v_result->>'item_id')::uuid for update;
 if v_item.custom_variant_id is distinct from p_variant_id then
   if (v_result->>'duplicate')::boolean then
     raise exception 'OperationId reutilizado com subproduto diferente';
   end if;
 end if;
 if p_variant_id is not null and not (v_result->>'duplicate')::boolean then
   select name into v_parent_name from public.products where id=p_product_id;
   update public.order_items set custom_variant_id=v_variant.id,
     custom_variant_name=v_variant.name,
     product_name=v_parent_name||' — '||v_variant.name
   where id=v_item.id;
   update public.audit_logs set metadata=metadata||jsonb_build_object(
     'custom_variant_id',v_variant.id,'custom_variant_name',v_variant.name)
   where entity_type='order_item' and entity_id=v_item.id::text
     and action='counter.manual_item_added';
 end if;
 select product_name into v_parent_name from public.order_items where id=v_item.id;
 return v_result||jsonb_build_object(
   'product_name',v_parent_name,
   'custom_variant_id',p_variant_id,
   'custom_variant_name',coalesce(v_variant.name,v_item.custom_variant_name)
 );
end; $$;
revoke execute on function public.register_staff_manual_counter_item_with_variant(bigint,uuid,numeric,uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.register_staff_manual_counter_item_with_variant(bigint,uuid,numeric,uuid,uuid,uuid)
 to service_role;
