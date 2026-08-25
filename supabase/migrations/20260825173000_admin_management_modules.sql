create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  document text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_transactions
  add column supplier_id uuid references public.suppliers(id) on delete set null;

create index suppliers_active_name_idx on public.suppliers(active, name);
create index financial_transactions_supplier_idx on public.financial_transactions(supplier_id, occurred_at desc);

alter table public.suppliers enable row level security;
revoke all on table public.suppliers from public, anon, authenticated;
grant all on table public.suppliers to service_role;

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

comment on table public.suppliers is 'Fornecedores e contatos comerciais da padaria.';
