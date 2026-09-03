-- Mantém a mesma prioridade determinística usada na Pesagem:
-- 1) código GeMaster exato; 2) referência exata; 3) referência curta em 6 dígitos;
-- 4) EAN exato; 5) nome parcial. Nunca mistura modos exatos entre si.

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
  v_mode text := 'name';
begin
  if v_query = '' or char_length(v_query) > 80 then
    raise exception 'Busca de produto invalida';
  end if;

  v_query_name := translate(
    lower(v_query),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );

  if v_query ~ '^[0-9]+$' and char_length(v_query) < 6 then
    v_padded_reference := lpad(
      coalesce(nullif(ltrim(v_query, '0'), ''), '0'),
      6,
      '0'
    );
  end if;

  if exists (
    select 1
    from public.product_external_mappings m
    join public.products p on p.id = m.product_id
    where m.provider = 'gemaster'
      and m.active
      and m.external_code = v_query
      and p.active
      and p.available_internal
      and p.price_configured
  ) then
    v_mode := 'gemaster_code';
  elsif exists (
    select 1
    from public.product_external_mappings m
    join public.products p on p.id = m.product_id
    where m.provider = 'gemaster'
      and m.active
      and m.external_reference = v_query
      and p.active
      and p.available_internal
      and p.price_configured
  ) then
    v_mode := 'reference';
  elsif v_padded_reference is not null and exists (
    select 1
    from public.product_external_mappings m
    join public.products p on p.id = m.product_id
    where m.provider = 'gemaster'
      and m.active
      and m.external_reference = v_padded_reference
      and p.active
      and p.available_internal
      and p.price_configured
  ) then
    v_mode := 'padded_reference';
  elsif exists (
    select 1
    from public.product_external_mappings m
    join public.products p on p.id = m.product_id
    where m.provider = 'gemaster'
      and m.active
      and m.external_ean = v_query
      and p.active
      and p.available_internal
      and p.price_configured
  ) then
    v_mode := 'ean';
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
        when v_mode = 'gemaster_code' then 'gemaster_code'
        when v_mode in ('reference', 'padded_reference') then 'reference'
        when v_mode = 'ean' then 'ean'
        else 'name'
      end as match_type,
      case
        when v_mode = 'gemaster_code' then 0
        when v_mode = 'reference' then 1
        when v_mode = 'padded_reference' then 2
        when v_mode = 'ean' then 3
        when translate(
          lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) = v_query_name then 10
        when translate(
          lower(p.name),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) like v_query_name || '%' then 20
        else 30
      end as match_rank,
      row_number() over (
        partition by p.id
        order by
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
        (v_mode = 'gemaster_code' and m.external_code = v_query)
        or (v_mode = 'reference' and m.external_reference = v_query)
        or (v_mode = 'padded_reference' and m.external_reference = v_padded_reference)
        or (v_mode = 'ean' and m.external_ean = v_query)
        or (
          v_mode = 'name'
          and translate(
            lower(p.name),
            'áàâãäéèêëíìîïóòôõöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ) like '%' || v_query_name || '%'
        )
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
