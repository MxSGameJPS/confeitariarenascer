alter table public.products
  add column available_delivery boolean not null default true,
  add column available_internal boolean not null default true;

update public.products
set available_delivery = false,
    featured = false
where pricing_mode = 'variable';

alter table public.products
  add constraint products_delivery_fixed_price_check
    check (not available_delivery or pricing_mode = 'fixed'),
  add constraint products_featured_delivery_check
    check (not featured or available_delivery);

create index products_delivery_catalog_idx
  on public.products(available_delivery, active, category_id, sort_order);

create index products_internal_catalog_idx
  on public.products(available_internal, active, category_id, sort_order);

comment on column public.products.available_delivery is
  'Disponibilidade no cardapio publico de delivery. Exige preco fixo.';
comment on column public.products.available_internal is
  'Disponibilidade em caixa e comandas, inclusive produtos de preco variavel.';

