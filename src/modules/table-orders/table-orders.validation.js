import { AppError } from "@/src/shared/errors/app-error";
import { validateTableToken } from "@/src/modules/tables/tables.validation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function invalid(message) { throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" }); }
function optional(value, max) { if (value == null || value === "") return null; if (typeof value !== "string") invalid("Texto inválido."); const text = value.trim(); if (text.length > max) invalid("Texto muito longo."); return text || null; }
export function validatePublicTableToken(value) { return validateTableToken(value); }
export function validateTableOrder(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 30) invalid("Selecione ao menos um produto.");
  return {
    customerName: optional(payload.customerName, 100),
    notes: optional(payload.notes, 300),
    items: payload.items.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!UUID.test(item?.productId ?? "") || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) invalid(`Item ${index + 1} inválido.`);
      return { productId: item.productId, quantity };
    }),
  };
}
