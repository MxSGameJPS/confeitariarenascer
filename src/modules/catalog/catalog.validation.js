import { AppError } from "@/src/shared/errors/app-error";

function parseBoolean(value, fieldName) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new AppError(`Parâmetro inválido: ${fieldName}`, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
  });
}

export function validateListProducts(searchParams) {
  const channel = searchParams.get("channel") || "delivery";
  if (!new Set(["delivery", "internal"]).has(channel)) {
    throw new AppError("Parâmetro inválido: channel", { statusCode: 400, code: "VALIDATION_ERROR" });
  }
  return {
    featured: parseBoolean(searchParams.get("featured"), "featured"),
    channel,
  };
}

export function validateListCategories() {
  return {};
}

