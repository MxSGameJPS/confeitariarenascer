-- Códigos curtos utilizados pela equipe, independentes do código interno GeMaster.
-- Um código pode apontar para produtos diferentes por modalidade: kg, un, custom.
create table if not exists public.operational_product_codes (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 code text not null,
 sale_type text not null check (sale_type in ('kg','un','custom')),
 created_at timestamptz not null default now(),
 unique(product_id,code,sale_type)
);
create index if not exists operational_product_codes_lookup_idx on public.operational_product_codes(code);
alter table public.operational_product_codes enable row level security;
revoke all on public.operational_product_codes from anon,authenticated;
grant all on public.operational_product_codes to service_role;
