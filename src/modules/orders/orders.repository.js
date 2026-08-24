import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function getStoreSettings() {
  const params = new URLSearchParams({
    select:
      "accepts_orders,delivery_fee,minimum_order,delivery_estimate_min,delivery_estimate_max,pickup_estimate_min,pickup_estimate_max",
    id: "eq.1",
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/store_settings?${params}`);
  return rows[0] ?? null;
}

export async function findActiveProductsByIds(productIds) {
  const params = new URLSearchParams({
    select: "id,name,price,active",
    id: `in.(${productIds.join(",")})`,
    active: "eq.true",
  });

  return supabaseServerRequest(`/rest/v1/products?${params}`);
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
