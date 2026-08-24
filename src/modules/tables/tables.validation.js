import { AppError } from "@/src/shared/errors/app-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function invalid(message) { throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" }); }
function integer(value, label, min, max) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min || parsed > max) invalid(`${label} inválido.`); return parsed; }
export function validateTableId(value) { if (!UUID.test(value ?? "")) invalid("Mesa inválida."); return value; }
export function validateTableToken(value) { if (!UUID.test(value ?? "")) invalid("QR Code da mesa inválido."); return value; }
export function validateCreateTable(payload) {
  if (!payload || typeof payload !== "object") invalid("Dados da mesa inválidos.");
  return { tableNumber: integer(payload.tableNumber, "Número da mesa", 1, 9999), seats: integer(payload.seats, "Quantidade de lugares", 1, 50) };
}
export function validateTableStatus(payload) {
  if (!payload || typeof payload.active !== "boolean" || typeof payload.commandEnabled !== "boolean") invalid("Status da mesa inválido.");
  return { active: payload.active, commandEnabled: payload.commandEnabled };
}
