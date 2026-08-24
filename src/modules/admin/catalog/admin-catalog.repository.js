import { getSupabaseServerEnv } from "@/src/config/env";
import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listCategoriesAdmin() {
  const params = new URLSearchParams({
    select: "id,name,slug,description,sort_order,active,created_at,updated_at",
    order: "sort_order.asc,name.asc",
  });
  return supabaseServerRequest(`/rest/v1/categories?${params}`);
}

export async function listProductsAdmin() {
  const params = new URLSearchParams({
    select: "id,category_id,name,slug,description,price,unit,image_path,featured,active,stock_control,stock_quantity,sort_order,pricing_mode,available_delivery,available_internal,created_at,updated_at,category:categories(id,name,slug)",
    order: "sort_order.asc,name.asc",
  });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

export async function findCategoryBySlug(slug) {
  const params = new URLSearchParams({ select: "id", slug: `eq.${slug}`, limit: "1" });
  const rows = await supabaseServerRequest(`/rest/v1/categories?${params}`);
  return rows[0] ?? null;
}

export async function findProductBySlug(slug) {
  const params = new URLSearchParams({ select: "id", slug: `eq.${slug}`, limit: "1" });
  const rows = await supabaseServerRequest(`/rest/v1/products?${params}`);
  return rows[0] ?? null;
}

export async function createCategory(data) {
  const rows = await supabaseServerRequest("/rest/v1/categories?select=*", {
    method: "POST",
    body: data,
    prefer: "return=representation",
  });
  return rows[0];
}

export async function updateCategory(id, data) {
  const rows = await supabaseServerRequest(`/rest/v1/categories?id=eq.${id}&select=*`, {
    method: "PATCH",
    body: data,
    prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function createProduct(data) {
  const rows = await supabaseServerRequest("/rest/v1/products?select=*", {
    method: "POST",
    body: data,
    prefer: "return=representation",
  });
  return rows[0];
}

export async function updateProduct(id, data) {
  const rows = await supabaseServerRequest(`/rest/v1/products?id=eq.${id}&select=*`, {
    method: "PATCH",
    body: data,
    prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function writeAuditLog({ actorId, action, entityType, entityId, metadata = {} }) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: {
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    },
  });
}

export async function uploadProductImage({ objectPath, file }) {
  const { url, secretKey, storageBucket } = getSupabaseServerEnv();
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(storageBucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Falha no upload para o Storage: ${message}`);
  }

  return objectPath;
}

