import { supabaseServerRequest } from "@/src/config/supabase/server";

const OPERATIONAL_PRODUCT_SELECT = "id,name,price,pricing_mode,unit,image_path";
const GEMASTER_MAPPING_SELECT = "product_id,external_code,external_reference,external_ean,organization_id,store_id,created_at";

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

async function findFallbackMappings(field, value, limit) {
  const params = new URLSearchParams({
    select: GEMASTER_MAPPING_SELECT,
    provider: "eq.gemaster",
    active: "eq.true",
    [field]: `eq.${value}`,
    limit: String(limit),
  });
  return supabaseServerRequest(`/rest/v1/product_external_mappings?${params}`);
}

async function loadFallbackProductsByMappings(mappings, matchType, limit) {
  const productIds = [...new Set(mappings.map((mapping) => mapping.product_id).filter(Boolean))].slice(0, limit);
  if (!productIds.length) return [];

  const params = new URLSearchParams({
    select: OPERATIONAL_PRODUCT_SELECT,
    id: `in.(${productIds.join(",")})`,
    active: "eq.true",
    available_internal: "eq.true",
    price_configured: "eq.true",
    order: "name.asc",
    limit: String(limit),
  });
  const products = await supabaseServerRequest(`/rest/v1/products?${params}`);
  const byProduct = new Map();
  for (const mapping of mappings) {
    if (!byProduct.has(mapping.product_id)) byProduct.set(mapping.product_id, mapping);
  }

  return products.map((product) => {
    const mapping = byProduct.get(product.id) || {};
    return {
      ...product,
      external_code: mapping.external_code || null,
      external_reference: mapping.external_reference || null,
      external_ean: mapping.external_ean || null,
      match_type: matchType,
      match_rank: matchType === "gemaster_code" ? 0 : matchType === "reference" ? 1 : 3,
    };
  });
}

async function fallbackOperationalProductSearch(query, limit) {
  const normalized = String(query || "").trim();

  let mappings = await findFallbackMappings("external_code", normalized, limit);
  if (mappings.length) return loadFallbackProductsByMappings(mappings, "gemaster_code", limit);

  mappings = await findFallbackMappings("external_reference", normalized, limit);
  if (mappings.length) return loadFallbackProductsByMappings(mappings, "reference", limit);

  if (/^\d+$/.test(normalized) && normalized.length < 6) {
    const numeric = normalized.replace(/^0+(?=\d)/, "") || "0";
    const padded = numeric.padStart(6, "0");
    if (padded !== normalized) {
      mappings = await findFallbackMappings("external_reference", padded, limit);
      if (mappings.length) return loadFallbackProductsByMappings(mappings, "reference", limit);
    }
  }

  mappings = await findFallbackMappings("external_ean", normalized, limit);
  if (mappings.length) return loadFallbackProductsByMappings(mappings, "ean", limit);

  const safeName = normalized.replace(/[*%]/g, "");
  if (!safeName) return [];

  const productParams = new URLSearchParams({
    select: OPERATIONAL_PRODUCT_SELECT,
    active: "eq.true",
    available_internal: "eq.true",
    price_configured: "eq.true",
    name: `ilike.*${safeName}*`,
    order: "name.asc",
    limit: String(limit),
  });
  const products = await supabaseServerRequest(`/rest/v1/products?${productParams}`);
  if (!products.length) return [];

  const productIds = products.map((product) => product.id);
  const mappingParams = new URLSearchParams({
    select: GEMASTER_MAPPING_SELECT,
    provider: "eq.gemaster",
    active: "eq.true",
    product_id: `in.(${productIds.join(",")})`,
    order: "created_at.desc",
    limit: String(Math.min(limit * 3, 90)),
  });
  const productMappings = await supabaseServerRequest(`/rest/v1/product_external_mappings?${mappingParams}`);
  const byProduct = new Map();
  for (const mapping of productMappings) {
    if (!byProduct.has(mapping.product_id)) byProduct.set(mapping.product_id, mapping);
  }

  return products.map((product) => {
    const mapping = byProduct.get(product.id) || {};
    return {
      ...product,
      external_code: mapping.external_code || null,
      external_reference: mapping.external_reference || null,
      external_ean: mapping.external_ean || null,
      match_type: "name",
      match_rank: 30,
    };
  });
}

export async function searchOperationalProducts(query, limit = 20) {
  try {
    return await supabaseServerRequest("/rest/v1/rpc/search_operational_products", {
      method: "POST",
      body: {
        p_query: query,
        p_limit: limit,
      },
      safeErrorPrefixes: ["Busca de produto invalida"],
    });
  } catch {
    // Contingência de deploy: mantém Caixa/Comandas utilizáveis até a migration
    // da RPC ser aplicada. A busca continua server-side e nunca baixa o catálogo inteiro.
    return fallbackOperationalProductSearch(query, limit);
  }
}
