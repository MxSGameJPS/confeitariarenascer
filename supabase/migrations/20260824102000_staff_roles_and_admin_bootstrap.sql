create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = case
  when role = 'admin' then 'superadmin'
  when role = 'operador' then 'atendente'
  else role
end;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'gerente', 'atendente'));

update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and u.email is not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text not null,
  password_hash text not null,
  role text not null check (role in ('gerente', 'atendente')),
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_username_format_check check (
    username = lower(username)
    and username ~ '^[a-z0-9._-]{3,30}$'
  )
);

create unique index if not exists employees_username_unique_idx
  on public.employees (lower(username));

create index if not exists employees_role_active_idx
  on public.employees (role, active, full_name);

create table if not exists public.employee_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists employee_sessions_employee_idx
  on public.employee_sessions (employee_id, expires_at desc);

create index if not exists employee_sessions_active_idx
  on public.employee_sessions (token_hash, expires_at)
  where revoked_at is null;

create table if not exists public.superadmin_bootstrap_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  canceled_at timestamptz,
  constraint superadmin_bootstrap_email_check check (email = lower(email))
);

create unique index if not exists superadmin_bootstrap_pending_email_idx
  on public.superadmin_bootstrap_requests (lower(email))
  where consumed_at is null and canceled_at is null;

alter table public.audit_logs
  add column if not exists actor_employee_id uuid references public.employees(id) on delete set null;

alter table public.audit_logs
  add column if not exists actor_kind text not null default 'admin';

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_kind_check;

alter table public.audit_logs
  add constraint audit_logs_actor_kind_check
  check (actor_kind in ('admin', 'employee', 'system'));

alter table public.employees enable row level security;
alter table public.employee_sessions enable row level security;
alter table public.superadmin_bootstrap_requests enable row level security;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_bootstrap public.superadmin_bootstrap_requests;
  v_role text := 'atendente';
  v_full_name text;
begin
  if new.email is not null then
    select *
      into v_bootstrap
    from public.superadmin_bootstrap_requests
    where lower(email) = lower(new.email)
      and consumed_at is null
      and canceled_at is null
    order by created_at desc
    limit 1
    for update;
  end if;

  if found then
    v_role := 'superadmin';
    v_full_name := v_bootstrap.full_name;
  else
    v_full_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    );
  end if;

  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    v_full_name,
    lower(new.email),
    v_role,
    true
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();

  if v_bootstrap.id is not null then
    update public.superadmin_bootstrap_requests
    set consumed_at = now()
    where id = v_bootstrap.id;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;
revoke all on function private.handle_new_auth_user() from anon;
revoke all on function private.handle_new_auth_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

drop function if exists public.handle_new_auth_user();
