import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function findPublicTable(token) {
  const params = new URLSearchParams({ select: "id,table_number,seats,active,command_enabled", public_token: `eq.${token}`, limit: "1" });
  return (await supabaseServerRequest(`/rest/v1/dining_tables?${params}`))[0] ?? null;
}

export async function findPublicOrderProducts(ids) {
  const params = new URLSearchParams({ select: "id,name,description,price,unit,image_path,pricing_mode,active,available_internal", id: `in.(${ids.join(",")})`, active: "eq.true", available_internal: "eq.true" });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

export async function createTableRequest(payload) {
  return supabaseServerRequest("/rest/v1/rpc/create_table_command_request_v2", { method: "POST", body: payload });
}

export async function openCustomerSession(payload) {
  return supabaseServerRequest("/rest/v1/rpc/open_table_customer_session_transaction", { method: "POST", body: payload });
}

export async function findCustomerSessionByHash(tokenHash, tableId) {
  const params = new URLSearchParams({
    select: "id,table_id,order_id,customer_name,customer_whatsapp,status,joined_at,closed_at",
    access_token_hash: `eq.${tokenHash}`,
    table_id: `eq.${tableId}`,
    limit: "1",
  });
  return (await supabaseServerRequest(`/rest/v1/command_customer_sessions?${params}`))[0] ?? null;
}

export async function findCommandOrder(orderId) {
  const params = new URLSearchParams({
    select: "id,order_number,table_id,table_visit_id,status,payment_status,total,command_label,visit:table_visits(id,status,opened_at,occupied_at,closed_at)",
    id: `eq.${orderId}`,
    channel: "eq.comanda",
    limit: "1",
  });
  return (await supabaseServerRequest(`/rest/v1/orders?${params}`))[0] ?? null;
}

export async function touchCustomerSession(id) {
  await supabaseServerRequest(`/rest/v1/command_customer_sessions?id=eq.${id}`, { method: "PATCH", body: { last_seen_at: new Date().toISOString() } });
}

export async function listCustomerRequests(sessionId) {
  const params = new URLSearchParams({
    select: "id,status,notes,created_at,accepted_at,items:order_items(id,product_name,quantity,unit_price,subtotal,pricing_mode,service_status,status,cancellation_reason)",
    customer_session_id: `eq.${sessionId}`,
    order: "created_at.desc",
    limit: "30",
  });
  return supabaseServerRequest(`/rest/v1/command_requests?${params}`);
}
