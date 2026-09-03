import { AppError } from "@/src/shared/errors/app-error";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMAND_PATTERN = /^C[1-9][0-9]{0,11}$/;
const DELIVERY_PATTERN = /^DV[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const PAYMENT_METHODS = new Set(["dinheiro", "pix", "credito", "debito"]);

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" });
}

function uuid(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  if (!UUID_PATTERN.test(String(value || ""))) invalid(`Campo inválido: ${field}`);
  return String(value);
}

function text(value, field, { required = false, max = 100 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) invalid(`Campo obrigatório: ${field}`);
    return null;
  }
  if (typeof value !== "string") invalid(`Campo inválido: ${field}`);
  const normalized = value.trim();
  if (required && !normalized) invalid(`Campo obrigatório: ${field}`);
  if (normalized.length > max) invalid(`Campo ${field} excede ${max} caracteres.`);
  return normalized || null;
}

export function validateBridgeResolve(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");
  const code = text(payload.code, "code", { required: true, max: 32 })?.toUpperCase();
  if (!COMMAND_PATTERN.test(code) && !DELIVERY_PATTERN.test(code)) {
    invalid("Código inválido. Use uma comanda C... ou um delivery DV...");
  }
  return { code, operationId: uuid(payload.operationId, "operationId") };
}

export function validateBridgeDispatchId(id) {
  return uuid(id, "dispatchId");
}

export function validateBridgeDispatchStatus(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");
  const status = text(payload.status, "status", { required: true, max: 20 });
  if (!["injected", "failed"].includes(status)) invalid("Status do Bridge inválido.");
  return { status, error: text(payload.error, "error", { max: 500 }) };
}

export function validateBridgeSettlement(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados da venda GeMaster inválidos.");

  const total = Number(payload.total);
  if (!Number.isFinite(total) || total < 0) invalid("Total da venda GeMaster inválido.");

  const paymentMethod = text(payload.paymentMethod, "paymentMethod", { max: 20 });
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
    invalid("Forma de pagamento GeMaster inválida.");
  }

  let completedAt = null;
  if (payload.completedAt !== undefined && payload.completedAt !== null && payload.completedAt !== "") {
    const parsed = new Date(payload.completedAt);
    if (Number.isNaN(parsed.getTime())) invalid("Data de conclusão GeMaster inválida.");
    completedAt = parsed.toISOString();
  }

  const metadata = payload.metadata ?? {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    invalid("Metadados GeMaster inválidos.");
  }
  if (JSON.stringify(metadata).length > 8192) invalid("Metadados GeMaster excedem o limite permitido.");

  return {
    operationId: uuid(payload.operationId, "operationId"),
    externalSaleId: text(payload.externalSaleId, "externalSaleId", { required: true, max: 120 }),
    total: Number(total.toFixed(2)),
    paymentMethod,
    fiscalDocument: text(payload.fiscalDocument, "fiscalDocument", { max: 120 }),
    completedAt,
    metadata,
  };
}

export function validateCreateBridgeDevice(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");
  return {
    name: text(payload.name, "name", { required: true, max: 80 }),
    organizationId: uuid(payload.organizationId, "organizationId", { optional: true }),
    storeId: uuid(payload.storeId, "storeId", { optional: true }),
  };
}

export function validateUpdateBridgeDevice(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");
  if (typeof payload.active !== "boolean") invalid("Campo inválido: active");
  return { active: payload.active };
}

export function validateBridgeDeviceId(id) {
  return uuid(id, "bridgeDeviceId");
}

export function validateGemasterMapping(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");
  const externalCode = text(payload.externalCode, "externalCode", { required: true, max: 64 });
  if (!/^[A-Za-z0-9._\/-]+$/.test(externalCode)) invalid("Código GeMaster inválido.");
  const externalEan = text(payload.externalEan, "externalEan", { max: 32 });
  if (externalEan && !/^[0-9]+$/.test(externalEan)) invalid("EAN GeMaster inválido.");
  return {
    productId: uuid(payload.productId, "productId"),
    externalCode,
    externalEan,
    organizationId: uuid(payload.organizationId, "organizationId", { optional: true }),
    storeId: uuid(payload.storeId, "storeId", { optional: true }),
  };
}
