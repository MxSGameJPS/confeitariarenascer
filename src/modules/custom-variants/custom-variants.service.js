import { supabaseServerRequest } from "@/src/config/supabase/server";
import { AppError } from "@/src/shared/errors/app-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireId(value) {
  if (!UUID.test(String(value || ""))) throw new AppError("Identificador inválido.", { statusCode: 400, code: "INVALID_ID" });
  return value;
}
async function requireCustomParent(productId) {
  requireId(productId);
  const products = await supabaseServerRequest("/rest/v1/operational_product_codes?" + new URLSearchParams({
    select: "product_id", product_id: "eq." + productId, sale_type: "eq.custom", limit: "1",
  }));
  if (!products.length) throw new AppError("O produto não aceita subprodutos personalizados.", { statusCode: 400, code: "NOT_CUSTOM_PRODUCT" });
}
export async function listVariants(productId) {
  await requireCustomParent(productId);
  return supabaseServerRequest("/rest/v1/custom_product_variants?" + new URLSearchParams({
    select: "id,product_id,name,active,sort_order", product_id: "eq." + productId, order: "sort_order.asc,name.asc",
  }));
}
export async function listActiveVariants(productId) {
  return (await listVariants(productId)).filter((item) => item.active);
}
export async function createVariant(productId, payload, actor) {
  await requireCustomParent(productId);
  const name = String(payload?.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new AppError("Nome deve ter entre 2 e 100 caracteres.", { statusCode: 400, code: "INVALID_VARIANT_NAME" });
  const existing = await listVariants(productId);
  if (existing.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
    throw new AppError("Este subproduto já existe.", { statusCode: 409, code: "VARIANT_EXISTS" });
  }
  const created = await supabaseServerRequest("/rest/v1/custom_product_variants?select=*", {
    method: "POST", body: { product_id: productId, name, active: true }, prefer: "return=representation",
  });
  await supabaseServerRequest("/rest/v1/audit_logs", { method: "POST", body: {
    actor_id: actor.id, action: "custom_variant.created", entity_type: "custom_variant",
    entity_id: created[0].id, metadata: { product_id: productId, name },
  } });
  return created[0];
}
export async function updateVariant(productId, variantId, payload, actor) {
  await requireCustomParent(productId);
  requireId(variantId);
  const old = (await listVariants(productId)).find((entry) => entry.id === variantId);
  if (!old) throw new AppError("Subproduto não encontrado.", { statusCode: 404, code: "VARIANT_NOT_FOUND" });
  const updated = {};
  if (Object.hasOwn(payload || {}, "name")) {
    const name = String(payload.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 100) throw new AppError("Nome inválido.", { statusCode: 400, code: "INVALID_VARIANT_NAME" });
    updated.name = name;
  }
  if (Object.hasOwn(payload || {}, "active")) {
    if (typeof payload.active !== "boolean") throw new AppError("Status inválido.", { statusCode: 400, code: "INVALID_VARIANT_STATUS" });
    updated.active = payload.active;
  }
  if (!Object.keys(updated).length) throw new AppError("Nenhuma alteração enviada.", { statusCode: 400, code: "EMPTY_UPDATE" });
  updated.updated_at = new Date().toISOString();
  const rows = await supabaseServerRequest("/rest/v1/custom_product_variants?" + new URLSearchParams({
    id: "eq." + variantId, product_id: "eq." + productId, select: "*",
  }), { method: "PATCH", body: updated, prefer: "return=representation" });
  await supabaseServerRequest("/rest/v1/audit_logs", { method: "POST", body: {
    actor_id: actor.id, action: "custom_variant.updated", entity_type: "custom_variant",
    entity_id: variantId, metadata: { product_id: productId, old_name: old.name, ...updated },
  } });
  return rows[0];
}
