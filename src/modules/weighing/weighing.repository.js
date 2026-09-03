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

export async function writeWeighingAdminAudit(actorId, action, entityId, metadata = {}) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: { actor_id: actorId, actor_kind: "admin", action, entity_type: "weighing_device", entity_id: entityId, metadata },
  });
}
