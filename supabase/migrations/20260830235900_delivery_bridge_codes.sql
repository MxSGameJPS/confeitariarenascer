-- Gera um identificador operacional curto para cada pedido de Delivery.
-- O código será usado futuramente pelo Renascer Bridge para localizar o pedido
-- e lançar seus itens no GeMaster sem depender do order_number sequencial.

alter table public.orders
  add column if not exists delivery_code text;

create or replace function public.generate_unique_delivery_code()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_candidate text;
  v_index integer;
begin
  loop
    v_candidate := 'DV';

    -- Usa random() nativo do PostgreSQL para evitar dependência de
    -- gen_random_bytes()/pgcrypto. A unicidade é garantida também pelo
    -- índice único criado abaixo.
    for v_index in 1..8 loop
      v_candidate := v_candidate || substr(
        v_alphabet,
        floor(random() * char_length(v_alphabet))::integer + 1,
        1
      );
    end loop;

    exit when not exists (
      select 1
      from public.orders
      where delivery_code = v_candidate
    );
  end loop;

  return v_candidate;
end;
$$;

-- Backfill dos deliveries já existentes antes de ativar a restrição.
-- É idempotente: se a execução anterior parou no meio, só preenche os nulos.
do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select id
    from public.orders
    where channel = 'delivery'
      and delivery_code is null
    order by created_at, id
    for update
  loop
    update public.orders
    set delivery_code = public.generate_unique_delivery_code()
    where id = v_order_id;
  end loop;
end;
$$;

create unique index if not exists orders_delivery_code_unique_idx
  on public.orders(delivery_code)
  where delivery_code is not null;

alter table public.orders
  drop constraint if exists orders_delivery_code_check;

alter table public.orders
  add constraint orders_delivery_code_check check (
    (channel = 'delivery' and delivery_code ~ '^DV[A-HJ-NP-Z2-9]{8}$')
    or
    (channel <> 'delivery' and delivery_code is null)
  );

create or replace function public.assign_delivery_code()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.channel = 'delivery' then
    if tg_op = 'UPDATE'
       and old.delivery_code is not null
       and new.delivery_code is distinct from old.delivery_code then
      raise exception 'Codigo do delivery nao pode ser alterado';
    end if;

    if new.delivery_code is null then
      new.delivery_code := public.generate_unique_delivery_code();
    end if;
  else
    new.delivery_code := null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_assign_delivery_code on public.orders;
create trigger orders_assign_delivery_code
before insert or update of channel, delivery_code on public.orders
for each row execute function public.assign_delivery_code();

revoke execute on function public.generate_unique_delivery_code() from public, anon, authenticated;
revoke execute on function public.assign_delivery_code() from public, anon, authenticated;

grant execute on function public.generate_unique_delivery_code() to service_role;

comment on column public.orders.delivery_code is
  'Codigo operacional aleatorio do Delivery, sempre iniciado por DV, para integracao com Bridge/PDV externo.';
comment on function public.generate_unique_delivery_code() is
  'Gera codigo DV + 8 caracteres sem 0/O e 1/I, reduzindo erros de digitacao no caixa.';
