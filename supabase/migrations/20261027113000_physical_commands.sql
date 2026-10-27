-- Inventário das comandas físicas numeradas. Registro separado das vendas históricas.
create table if not exists public.physical_commands (
  id uuid primary key default gen_random_uuid(),
  command_number bigint not null unique check (command_number between 1 and 999999999999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint physical_commands_positive check (command_number > 0)
);
create index if not exists physical_commands_active_number_idx on public.physical_commands (active, command_number);
alter table public.physical_commands enable row level security;
-- Acesso exclusivamente pela API server-side autenticada; nenhum grant para anon/authenticated.
revoke all on public.physical_commands from anon, authenticated;
