import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listTables() {
  const params = new URLSearchParams({ select: "id,table_number,seats,public_token,active,command_enabled,created_at,updated_at", order: "table_number.asc" });
  return supabaseServerRequest(`/rest/v1/dining_tables?${params}`);
}
export async function findTableByNumber(tableNumber) {
  const params = new URLSearchParams({ select: "id", table_number: `eq.${tableNumber}`, limit: "1" });
  return (await supabaseServerRequest(`/rest/v1/dining_tables?${params}`))[0] ?? null;
}
export async function findTableById(id) {
  const params = new URLSearchParams({ select: "id,table_number,seats,public_token,active,command_enabled", id: `eq.${id}`, limit: "1" });
  return (await supabaseServerRequest(`/rest/v1/dining_tables?${params}`))[0] ?? null;
}
export async function createTable(data) {
  return (await supabaseServerRequest("/rest/v1/dining_tables?select=*", { method: "POST", body: data, prefer: "return=representation" }))[0];
}
export async function updateTable(id, data) {
  return (await supabaseServerRequest(`/rest/v1/dining_tables?id=eq.${id}&select=*`, { method: "PATCH", body: data, prefer: "return=representation" }))[0] ?? null;
}
export async function writeTableAudit({ actor, action, entityId, metadata }) {
  await supabaseServerRequest("/rest/v1/audit_logs", { method: "POST", body: {
    actor_id: actor.kind === "admin" ? actor.id : null,
    actor_employee_id: actor.kind === "employee" ? actor.id : null,
    actor_kind: actor.kind === "admin" ? "admin" : "employee",
    action, entity_type: "dining_table", entity_id: entityId, metadata,
  } });
}
