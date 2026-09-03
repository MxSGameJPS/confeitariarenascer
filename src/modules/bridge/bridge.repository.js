import { supabaseServerRequest } from "@/src/config/supabase/server";

const BRIDGE_SAFE_ERRORS = [
  "Bridge inativo ou inexistente",
  "OperationId obrigatorio",
  "OperationId reutilizado com codigo diferente",
  "Comanda nao encontrada ou encerrada",
  "Comanda possui solicitacoes pendentes",
  "Delivery nao encontrado ou ainda nao aceito",
  "Pedido possui itens ainda nao aceitos",
  "Item sem produto vinculado:",
  "Produto sem mapeamento GeMaster:",
  "Pedido sem itens ativos",
  "Codigo nao pertence ao Renascer",
];

const SETTLEMENT_SAFE_ERRORS = [
  "Dados da liquidacao invalidos",
  "Identificacao da venda GeMaster invalida",
  "Total da venda GeMaster invalido",
  "Forma de pagamento GeMaster invalida",
  "Documento fiscal GeMaster invalido",
  "Metadados GeMaster invalidos",
  "Bridge inativo ou inexistente",
  "Despacho do Bridge nao encontrado",
  "Liquidacao automatica suportada apenas para comanda",
  "Venda ainda nao foi confirmada como injetada no GeMaster",
  "Despacho do Bridge falhou e nao pode ser liquidado",
  "Comanda do despacho nao encontrada",
  "Comanda nao esta aberta para liquidacao",
  "Comanda possui pedidos aguardando atendimento",
  "Comanda possui itens ainda nao aceitos",
  "Comanda alterada apos envio ao GeMaster",
  "Total da venda GeMaster diverge da comanda",
  "Itens da comanda mudaram apos envio ao GeMaster",
];

export async function findBridgeDeviceByTokenHash(tokenHash) {
  const params = new URLSearchParams({
    select: "id,name,organization_id,store_id,active,last_seen_at",
    token_hash: `eq.${tokenHash}`,
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/bridge_devices?${params}`);
  return rows[0] ?? null;
}

export async function touchBridgeDevice(id) {
  await supabaseServerRequest(`/rest/v1/bridge_devices?id=eq.${id}`, {
    method: "PATCH",
    body: { last_seen_at: new Date().toISOString() },
  });
}

export async function listBridgeDevices() {
  const params = new URLSearchParams({
    select: "id,name,organization_id,store_id,active,last_seen_at,created_at,updated_at",
    order: "name.asc",
  });
  return supabaseServerRequest(`/rest/v1/bridge_devices?${params}`);
}

export async function createBridgeDevice(data) {
  const rows = await supabaseServerRequest(
    "/rest/v1/bridge_devices?select=id,name,organization_id,store_id,active,last_seen_at,created_at",
    { method: "POST", body: data, prefer: "return=representation" }
  );
  return rows[0];
}

export async function updateBridgeDevice(id, data) {
  const rows = await supabaseServerRequest(
    `/rest/v1/bridge_devices?id=eq.${id}&select=id,name,organization_id,store_id,active,last_seen_at,created_at,updated_at`,
    { method: "PATCH", body: data, prefer: "return=representation" }
  );
  return rows[0] ?? null;
}

export async function prepareBridgeDispatch(payload) {
  return supabaseServerRequest("/rest/v1/rpc/prepare_gemaster_bridge_dispatch", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: BRIDGE_SAFE_ERRORS,
  });
}

export async function updateBridgeDispatchStatus(payload) {
  return supabaseServerRequest("/rest/v1/rpc/update_gemaster_bridge_dispatch_status", {
    method: "POST",
    body: payload,
  });
}

export async function confirmBridgeSettlement(payload) {
  return supabaseServerRequest("/rest/v1/rpc/confirm_gemaster_bridge_settlement", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: SETTLEMENT_SAFE_ERRORS,
  });
}

export async function listGemasterMappings() {
  const mappingParams = new URLSearchParams({
    select: "id,product_id,organization_id,store_id,external_code,external_ean,active,metadata,created_at,updated_at",
    provider: "eq.gemaster",
    order: "created_at.desc",
    limit: "1000",
  });
  const productParams = new URLSearchParams({
    select: "id,name,pricing_mode,unit,active,available_internal",
    active: "eq.true",
    available_internal: "eq.true",
    order: "name.asc",
    limit: "1000",
  });
  const [mappings, products] = await Promise.all([
    supabaseServerRequest(`/rest/v1/product_external_mappings?${mappingParams}`),
    supabaseServerRequest(`/rest/v1/products?${productParams}`),
  ]);
  return { mappings, products };
}

export async function findGemasterMapping({ productId, organizationId, storeId }) {
  const params = new URLSearchParams({
    select: "id,product_id,organization_id,store_id,external_code,external_ean,active,metadata,created_at,updated_at",
    provider: "eq.gemaster",
    product_id: `eq.${productId}`,
    organization_id: organizationId ? `eq.${organizationId}` : "is.null",
    store_id: storeId ? `eq.${storeId}` : "is.null",
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/product_external_mappings?${params}`);
  return rows[0] ?? null;
}

export async function createGemasterMapping(data) {
  const rows = await supabaseServerRequest(
    "/rest/v1/product_external_mappings?select=id,product_id,organization_id,store_id,external_code,external_ean,active,metadata,created_at,updated_at",
    { method: "POST", body: data, prefer: "return=representation" }
  );
  return rows[0];
}

export async function updateGemasterMapping(id, data) {
  const rows = await supabaseServerRequest(
    `/rest/v1/product_external_mappings?id=eq.${id}&select=id,product_id,organization_id,store_id,external_code,external_ean,active,metadata,created_at,updated_at`,
    { method: "PATCH", body: data, prefer: "return=representation" }
  );
  return rows[0] ?? null;
}

export async function writeBridgeAdminAudit(actorId, action, entityType, entityId, metadata = {}) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: { actor_id: actorId, actor_kind: "admin", action, entity_type: entityType, entity_id: entityId, metadata },
  });
}
