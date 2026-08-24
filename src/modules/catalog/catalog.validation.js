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
  return {
    featured: parseBoolean(searchParams.get("featured"), "featured"),
  };
}

export function validateListCategories() {
  return {};
}
