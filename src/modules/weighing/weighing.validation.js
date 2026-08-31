import { AppError } from "@/src/shared/errors/app-error";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" });
}

export function validateWeighingCommandNumber(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) invalid("Número da comanda inválido.");
  return parsed;
}

export function validateWeighingItem(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados da pesagem inválidos.");
  if (typeof payload.productId !== "string" || !UUID_PATTERN.test(payload.productId)) invalid("Produto inválido.");
  if (typeof payload.operationId !== "string" || !UUID_PATTERN.test(payload.operationId)) invalid("OperationId inválido.");
  const weightKg = Number(payload.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100) invalid("Peso inválido.");
  return { productId: payload.productId, operationId: payload.operationId, weightKg: Number(weightKg.toFixed(3)) };
}

export function validateWeighingProductQuery(searchParams) {
  const query = String(searchParams.get("query") || "").trim().slice(0, 80);
  return query;
}

export function validateCreateWeighingDevice(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados do dispositivo inválidos.");
  const name = String(payload.name || "").trim();
  if (name.length < 2 || name.length > 80) invalid("Nome do dispositivo inválido.");
  return { name };
}

export function validateUpdateWeighingDevice(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.active !== "boolean") invalid("Status do dispositivo inválido.");
  return { active: payload.active };
}

export function validateWeighingDeviceId(value) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) invalid("Dispositivo inválido.");
  return value;
}
