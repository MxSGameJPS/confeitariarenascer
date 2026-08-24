import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function getStoreSettings() {
  const params = new URLSearchParams({
    select:
      "accepts_orders,delivery_fee,minimum_order,delivery_estimate_min,delivery_estimate_max,pickup_estimate_min,pickup_estimate_max,business_hours,delivery_areas,store_timezone",
    id: "eq.1",
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/store_settings?${params}`);
  return rows[0] ?? null;
}

export async function findActiveProductsByIds(productIds) {
  const params = new URLSearchParams({
    select: "id,name,price,active,pricing_mode,available_delivery",
    id: `in.(${productIds.join(",")})`,
    active: "eq.true",
    available_delivery: "eq.true",
  });

  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

export async function findDeliveryByTrackingToken(token) {
  const params = new URLSearchParams({
    select: "order_number,status,payment_status,payment_method,fulfillment_type,subtotal,delivery_fee,total,created_at,accepted_at,preparation_started_at,ready_at,dispatched_at,completed_at,items:order_items(product_name,quantity,unit_price,subtotal,pricing_mode,status)",
    tracking_token: `eq.${token}`,
    channel: "eq.delivery",
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/orders?${params}`);
  return rows[0] ?? null;
}

export async function createOrderTransaction({ customer, order, items }) {
  return supabaseServerRequest("/rest/v1/rpc/create_order_transaction", {
    method: "POST",
    body: {
      p_customer: customer,
      p_order: order,
      p_items: items,
    },
  });
}

