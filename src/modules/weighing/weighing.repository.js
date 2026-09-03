import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function findWeighingDeviceByTokenHash(tokenHash) {
  const params = new URLSearchParams({ select: "id,name,active,last_seen_at", token_hash: `eq.${tokenHash}`, limit: "1" });
  const rows = await supabaseServerRequest(`/rest/v1/weighing_devices?${params}`);
  return rows[0] ?? null;
}

export async function touchWeighingDevice(id) {
  await supabaseServerRequest(`/rest/v1/weighing_devices?id=eq.${id}`, { method: "PATCH", body: { last_seen_at: new Date().toISOString() } });
}

export async function listWeighingDevices() {
  const params = new URLSearchParams({ select: "id,name,active,last_seen_at,created_at,updated_at", order: "name.asc" });
  return supabaseServerRequest(`/rest/v1/weighing_devices?${params}`);
}

export async function createWeighingDevice(data) {
  const rows = await supabaseServerRequest("/rest/v1/weighing_devices?select=id,name,active,last_seen_at,created_at", {
    method: "POST", body: data, prefer: "return=representation",
  });
  return rows[0];
}

export async function updateWeighingDevice(id, data) {
  const rows = await supabaseServerRequest(`/rest/v1/weighing_devices?id=eq.${id}&select=id,name,active,last_seen_at,created_at,updated_at`, {
    method: "PATCH", body: data, prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function listWeighingProducts() {
  const params = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal",
    active: "eq.true",
    available_internal: "eq.true",
    price_configured: "eq.true",
    pricing_mode: "eq.variable",
    order: "name.asc",
    limit: "300",
  });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

async function findProductForWeighingById(productId) {
  const params = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path",
    id: `eq.${productId}`,
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/products?${params}`);
  return rows[0] ?? null;
}

export async function findWeighingProductByExternalCode(externalCode) {
  const mappingParams = new URLSearchParams({
    select: "id,product_id,external_code,external_reference,external_ean",
    provider: "eq.gemaster",
    external_code: `eq.${externalCode}`,
    active: "eq.true",
    organization_id: "is.null",
    store_id: "is.null",
    limit: "1",
  });
  const mappings = await supabaseServerRequest(`/rest/v1/product_external_mappings?${mappingParams}`);
  const mapping = mappings[0] ?? null;

  if (mapping) {
    const product = await findProductForWeighingById(mapping.product_id);
    return product ? { product, mapping } : null;
  }

  const fallbackParams = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path",
    weighing_code: `eq.${String(externalCode).toUpperCase()}`,
    limit: "1",
  });
  const products = await supabaseServerRequest(`/rest/v1/products?${fallbackParams}`);
  const product = products[0] ?? null;
  return product ? {
    product,
    mapping: {
      external_code: product.weighing_code,
      external_reference: null,
      external_ean: null,
    },
  } : null;
}

export async function findOpenCommandByNumber(orderNumber) {
  const params = new URLSearchParams({
    select: "id,order_number,status,command_label,total,table:dining_tables(id,table_number)",
    order_number: `eq.${orderNumber}`, channel: "eq.comanda", status: "eq.aberto", limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/orders?${params}`);
  return rows[0] ?? null;
}

export async function registerWeighingItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_weighing_item_transaction", { method: "POST", body: payload });
}

export async function registerStaffWeighingItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_staff_weighing_item_transaction", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: [
      "Numero da comanda",
      "Comanda",
      "Produto",
      "Peso",
      "OperationId",
      "Funcionario",
      "Valor calculado",
    ],
  });
}

export async function writeWeighingAdminAudit(actorId, action, entityId, metadata = {}) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: { actor_id: actorId, actor_kind: "admin", action, entity_type: "weighing_device", entity_id: entityId, metadata },
  });
}
