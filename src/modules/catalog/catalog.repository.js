import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listActiveCategories() {
  const params = new URLSearchParams({
    select: "id,name,slug,description,sort_order",
    active: "eq.true",
    order: "sort_order.asc,name.asc",
  });

  return supabaseServerRequest(`/rest/v1/categories?${params}`);
}

export async function listActiveProducts({ featured } = {}) {
  const params = new URLSearchParams({
    select:
      "id,category_id,name,slug,description,price,image_path,featured,unit,sort_order,pricing_mode,category:categories(id,name,slug)",
    active: "eq.true",
    order: "sort_order.asc,name.asc",
  });

  if (featured !== undefined) {
    params.set("featured", `eq.${featured}`);
  }

  return supabaseServerRequest(`/rest/v1/products?${params}`);
}
