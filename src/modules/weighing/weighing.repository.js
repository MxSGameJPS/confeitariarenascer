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

async function findProductForWeighingById(productId) {
  const params = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path",
    id: `eq.${productId}`,
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/products?${params}`);
  return rows[0] ?? null;
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

  // Primeiro respeita exatamente o que veio do GeMaster.
  // Ex.: referência 77 continua sendo 77.
  const exact = await findGemasterMappings("external_reference", normalized, 3);
  if (exact.length) return exact;

  // As referências internas de produtos de produção são gravadas com 6 dígitos.
  // No balcão, porém, a equipe digita apenas o número conhecido:
  // 01 -> 000001, 10 -> 000010, 32 -> 000032.
  // Não tentamos todas as combinações intermediárias porque isso cria falsas ambiguidades.
  if (/^\d+$/.test(normalized) && normalized.length < 6) {
    const numericValue = normalized.replace(/^0+(?=\d)/, "") || "0";
    const padded = numericValue.padStart(6, "0");
    if (padded !== normalized) {
      return findGemasterMappings("external_reference", padded, 3);
    }
  }

  return [];
}

export async function findWeighingProductByExternalCode(identifier) {
  const normalized = String(identifier || "").trim();

  // O código interno do GeMaster tem prioridade absoluta.
  const codeMappings = await findGemasterMappings("external_code", normalized, 1);
  if (codeMappings[0]) {
    const product = await findProductForWeighingById(codeMappings[0].product_id);
    return product ? { product, mapping: codeMappings[0], matchedBy: "code" } : null;
  }

  // Depois aceita a referência usada no balcão.
  // Ex.: 77 -> PIZZA e 01 -> referência 000001 do PÃO FRANCÊS.
  const referenceMappings = await findReferenceMappings(normalized);
  if (referenceMappings.length > 1) {
    return { ambiguous: true, matchedBy: "reference", matches: referenceMappings };
  }
  if (referenceMappings[0]) {
    const product = await findProductForWeighingById(referenceMappings[0].product_id);
    return product ? { product, mapping: referenceMappings[0], matchedBy: "reference" } : null;
  }

  // Compatibilidade com EAN digitado exatamente como cadastrado.
  const eanMappings = await findGemasterMappings("external_ean", normalized, 3);
  if (eanMappings.length > 1) {
    return { ambiguous: true, matchedBy: "reference", matches: eanMappings };
  }
  if (eanMappings[0]) {
    const product = await findProductForWeighingById(eanMappings[0].product_id);
    return product ? { product, mapping: eanMappings[0], matchedBy: "reference" } : null;
  }

  const fallbackParams = new URLSearchParams({
    select: "id,name,price,price_configured,unit,weighing_code,pricing_mode,active,available_internal,image_path",
    weighing_code: `eq.${normalized.toUpperCase()}`,
    limit: "1",
  });
  const products = await supabaseServerRequest(`/rest/v1/products?${fallbackParams}`);
  const product = products[0] ?? null;
  return product ? {
    product,
    matchedBy: "weighing_code",
    mapping: {
      external_code: product.weighing_code,
      external_reference: null,
      external_ean: null,
    },
  } : null;
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

export async function writeWeighingAdminAudit(actorId, action, entityId, metadata = {}) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: { actor_id: actorId, actor_kind: "admin", action, entity_type: "weighing_device", entity_id: entityId, metadata },
  });
}
