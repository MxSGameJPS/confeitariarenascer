import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function findWeighingDeviceByTokenHash(tokenHash) {
  const params = new URLSearchParams({ select: "id,name,active,last_seen_at", token_hash: `eq.${tokenHash}`, limit: "1" });
  const rows = await supabaseServerRequest(`/rest/v1/weighing_devices?${params}`);
  return rows[0] ?? null;
}

export async function touchWeighingDevice(id) {
  await supabaseServerRequest(`/rest/v1/weighing_devices?id=eq.${id}`, { method: "PATCH", body: { last_seen_at: new Date().toISOString() } });
}

export async function listWeighingDevices() {
  const params = new URLSearchParams({ select: "id,name,active,last_seen_at,created_at,updated_at", order: "name.asc" });
  return supabaseServerRequest(`/rest/v1/weighing_devices?${params}`);
}

export async function createWeighingDevice(data) {
  const rows = await supabaseServerRequest("/rest/v1/weighing_devices?select=id,name,active,last_seen_at,created_at", {
    method: "POST", body: data, prefer: "return=representation",
  });
  return rows[0];
}

export async function updateWeighingDevice(id, data) {
  const rows = await supabaseServerRequest(`/rest/v1/weighing_devices?id=eq.${id}&select=id,name,active,last_seen_at,created_at,updated_at`, {
    method: "PATCH", body: data, prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function listWeighingProducts() {
  const params = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal",
    active: "eq.true",
    available_internal: "eq.true",
    price_configured: "eq.true",
    pricing_mode: "eq.variable",
    order: "name.asc",
    limit: "300",
  });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}

async function findProductForCounterById(productId) {
  const params = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path,stock_control,stock_quantity",
    id: `eq.${productId}`,
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/products?${params}`);
  return rows[0] ?? null;
}

export async function findStaffCounterProductById(productId) {
  return findProductForCounterById(productId);
}

async function findGemasterMappings(field, value, limit = 3) {
  const params = new URLSearchParams({
    select: "id,product_id,external_code,external_reference,external_ean",
    provider: "eq.gemaster",
    [field]: `eq.${value}`,
    active: "eq.true",
    organization_id: "is.null",
    store_id: "is.null",
    limit: String(limit),
  });
  return supabaseServerRequest(`/rest/v1/product_external_mappings?${params}`);
}

async function findReferenceMappings(identifier) {
  const normalized = String(identifier || "").trim();
  const numeric = /^\d+$/.test(normalized)
    ? (normalized.replace(/^0+(?=\d)/, "") || "0")
    : null;
  const candidates = [...new Set([
    normalized,
    ...(numeric !== null ? [numeric, numeric.padStart(6, "0")] : []),
  ])];
  const mappings = (await Promise.all(
    candidates.map((value) => findGemasterMappings("external_reference", value, 50)),
  )).flat();
  return [...new Map(mappings.map((mapping) => [mapping.product_id, mapping])).values()];
}

export async function findWeighingProductByExternalCode(identifier) {
  const normalized = String(identifier || "").trim();
  const found = new Map();
  async function add(mapping, matchedBy) {
    if (!mapping || found.has(mapping.product_id)) return;
    const product = await findProductForCounterById(mapping.product_id);
    if (product?.active && product.available_internal && product.price_configured && Number(product.price) > 0) {
      found.set(mapping.product_id, { product, mapping, matchedBy });
    }
  }
  // Prioriza os códigos operacionais confirmados pelo proprietário.
  const operationalParams = new URLSearchParams({
    select: "product_id,code,sale_type",
    code: `eq.${normalized}`,
    limit: "50",
  });
  const operationalCodes = await supabaseServerRequest(`/rest/v1/operational_product_codes?${operationalParams}`);
  for (const entry of operationalCodes) {
    const product = await findProductForCounterById(entry.product_id);
    if (product?.active && product.available_internal && (entry.sale_type === "custom" || (product.price_configured && Number(product.price) > 0))) {
      const gemasterMapping = (await findGemasterMappings("product_id", product.id, 1))[0];
      found.set(product.id, {
        product,
        matchedBy: "operational_code",
        saleType: entry.sale_type,
        mapping: gemasterMapping || {
          external_code: null,
          external_reference: entry.code,
          external_ean: null,
        },
      });
    }
  }
  // Código Gemaster exato e referências de balcão são namespaces diferentes.
  for (const mapping of await findGemasterMappings("external_code", normalized, 50)) {
    await add(mapping, "code");
  }
  for (const mapping of await findReferenceMappings(normalized)) {
    await add(mapping, "reference");
  }
  for (const mapping of await findGemasterMappings("external_ean", normalized, 50)) {
    await add(mapping, "reference");
  }
  const fallbackParams = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path,stock_control,stock_quantity",
    weighing_code: `eq.${normalized.toUpperCase()}`,
    limit: "50",
  });
  const fallback = await supabaseServerRequest(`/rest/v1/products?${fallbackParams}`);
  for (const product of fallback) {
    if (!found.has(product.id) && product.active && product.available_internal && product.price_configured && Number(product.price) > 0) {
      found.set(product.id, {
        product,
        matchedBy: "weighing_code",
        mapping: { external_code: product.weighing_code, external_reference: null, external_ean: null },
      });
    }
  }
  return [...found.values()];
}

export async function findOpenCommandByNumber(orderNumber) {
  const params = new URLSearchParams({
    select: "id,order_number,status,command_label,total,table:dining_tables(id,table_number)",
    order_number: `eq.${orderNumber}`, channel: "eq.comanda", status: "eq.aberto", limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/orders?${params}`);
  return rows[0] ?? null;
}

export async function findOpenStaffCommandByPhysicalNumber(commandNumber) {
  const commandCode = `C${commandNumber}`;
  const params = new URLSearchParams({
    select: "id,order_number,status,command_label,total,table:dining_tables(id,table_number)",
    command_label: `eq.${commandCode}`,
    channel: "eq.comanda",
    status: "eq.aberto",
    order: "created_at.desc",
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/orders?${params}`);
  return rows[0] ?? null;
}

export async function openStaffCounterCommand({ commandNumber, operationId, actor }) {
  return supabaseServerRequest("/rest/v1/rpc/open_counter_command_transaction", {
    method: "POST",
    body: {
      p_command_label: `C${commandNumber}`,
      p_operation_key: operationId,
      p_actor_kind: "employee",
      p_actor_id: actor.id,
    },
    safeErrorPrefixes: [
      "OperationId",
      "Operador",
      "Identificacao da comanda",
    ],
  });
}

export async function registerWeighingItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_weighing_item_transaction", { method: "POST", body: payload });
}

export async function registerStaffWeighingItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_staff_weighing_item_transaction", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: [
      "Numero da comanda",
      "Comanda",
      "Produto",
      "Peso",
      "OperationId",
      "Funcionario",
      "Valor calculado",
    ],
  });
}

export async function registerStaffFixedCounterItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_staff_fixed_counter_item_transaction", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: [
      "Numero da comanda",
      "Comanda",
      "Produto",
      "Quantidade",
      "OperationId",
      "Funcionario",
      "Valor calculado",
      "Estoque insuficiente",
    ],
  });
}

export async function writeWeighingAdminAudit(actorId, action, entityId, metadata = {}) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: { actor_id: actorId, actor_kind: "admin", action, entity_type: "weighing_device", entity_id: entityId, metadata },
  });
}

export async function findStaffCounterSaleType(productId) {
  const params = new URLSearchParams({
    select: "sale_type",
    product_id: `eq.${productId}`,
    sale_type: "eq.custom",
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/operational_product_codes?${params}`);
  return rows[0]?.sale_type || null;
}

export async function registerStaffManualCounterItem(payload) {
  return supabaseServerRequest("/rest/v1/rpc/register_staff_manual_counter_item_with_variant", {
    method: "POST",
    body: payload,
    safeErrorPrefixes: ["Numero da comanda","Comanda","Produto","Valor personalizado","OperationId","Funcionario"],
  });
}
