import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listActiveCategories() {
  const params = new URLSearchParams({
    select: "id,name,slug,description,sort_order",
    active: "eq.true",
    order: "sort_order.asc,name.asc",
  });

  return supabaseServerRequest(`/rest/v1/categories?${params}`);
}

export async function listActiveProducts({ featured, channel = "delivery" } = {}) {
  const params = new URLSearchParams({
    select:
      "id,category_id,name,slug,description,price,price_configured,image_path,featured,unit,sort_order,pricing_mode,available_delivery,available_internal,category:categories(id,name,slug)",
    active: "eq.true",
    price_configured: "eq.true",
    order: "sort_order.asc,name.asc",
  });

  if (featured !== undefined) {
    params.set("featured", `eq.${featured}`);
  }

  params.set(channel === "internal" ? "available_internal" : "available_delivery", "eq.true");

  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

export async function searchOperationalProducts(query, limit = 20) {
  return supabaseServerRequest("/rest/v1/rpc/search_operational_products", {
    method: "POST",
    body: {
      p_query: query,
      p_limit: limit,
    },
    safeErrorPrefixes: ["Busca de produto invalida"],
  });
}
