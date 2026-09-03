-- A idempotência da venda GeMaster é protegida pela combinação store_id + externalSaleId
-- dentro de confirm_gemaster_bridge_settlement, usando advisory lock transacional.
-- Não mantemos unicidade física neste índice porque settle_command_from_external_pos
-- cria a linha antes de ela receber o store_id, o que poderia colidir entre unidades.

drop index if exists public.external_pos_settlements_provider_store_reference_unique_idx;

create index if not exists external_pos_settlements_provider_store_reference_idx
  on public.external_pos_settlements (
    provider,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    external_reference
  )
  where external_reference is not null;

comment on index public.external_pos_settlements_provider_store_reference_idx is
  'Acelera lookup de vendas externas por provedor/unidade; idempotencia concorrente e garantida pela RPC com advisory lock.';
