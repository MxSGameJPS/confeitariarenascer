import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listOperationalSales({ channel, status }) {
  const params = new URLSearchParams({
    select: "id,order_number,channel,status,payment_status,payment_method,fulfillment_type,subtotal,delivery_fee,total,change_for,address_street,address_number,address_neighborhood,address_complement,address_reference,command_label,notes,created_at,accepted_at,preparation_started_at,ready_at,dispatched_at,completed_at,closed_at,canceled_at,table_visit_id,visit:table_visits(id,status,opened_at,occupied_at,closed_at),table:dining_tables(id,table_number,seats),customer:customers(id,name,phone),responsible_employee:employees(id,full_name,username),items:order_items(id,request_id,product_id,product_name,unit_price,quantity,subtotal,pricing_mode,service_status,status,canceled_at,cancellation_reason),requests:command_requests(id,customer_name,notes,status,accepted_at,created_at),payments:sale_payments(id,method,amount,status,confirmed_at)",
    order: "created_at.desc",
    limit: "100",
  });
  if (channel) params.set("channel", `eq.${channel}`);
  if (status) params.set("status", `eq.${status}`);
  return supabaseServerRequest(`/rest/v1/orders?${params}`);
}

export async function findProductsForSale(productIds) {
  const params = new URLSearchParams({
    select: "id,name,price,active,stock_control,stock_quantity,pricing_mode,available_internal",
    id: `in.(${productIds.join(",")})`,
    active: "eq.true",
    available_internal: "eq.true",
  });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

export async function createOperationalSale(payload) {
  return supabaseServerRequest("/rest/v1/rpc/create_operational_sale_transaction", { method: "POST", body: payload });
}

export async function acceptDelivery(payload) {
  return supabaseServerRequest("/rest/v1/rpc/accept_delivery_transaction", { method: "POST", body: payload });
}

export async function advanceDelivery(payload) {
  return supabaseServerRequest("/rest/v1/rpc/advance_delivery_transaction", { method: "POST", body: payload });
}

export async function closeCommand(payload) {
  return supabaseServerRequest("/rest/v1/rpc/close_command_transaction", { method: "POST", body: payload });
}

export async function cancelSale(payload) {
  return supabaseServerRequest("/rest/v1/rpc/cancel_sale_transaction", { method: "POST", body: payload });
}

export async function acceptCommandRequest(payload) {
  return supabaseServerRequest("/rest/v1/rpc/accept_command_request_transaction", { method: "POST", body: payload });
}
export async function rejectCommandRequest(payload) {
  return supabaseServerRequest("/rest/v1/rpc/reject_command_request_transaction", { method: "POST", body: payload });
}

export async function addCommandItems(payload) {
  return supabaseServerRequest("/rest/v1/rpc/add_command_items_transaction", { method: "POST", body: payload });
}
