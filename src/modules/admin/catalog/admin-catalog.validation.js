import { AppError } from "@/src/shared/errors/app-error";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message) {
  throw new AppError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
  });
}

function text(value, field, { required = false, max = 180 } = {}) {
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

function boolean(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") invalid(`Campo inválido: ${field}`);
  return value;
}

function integer(value, field, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) invalid(`Campo inválido: ${field}`);
  return parsed;
}

export function validateId(id) {
  if (!UUID_PATTERN.test(id || "")) invalid("Identificador inválido.");
  return id;
}

export function validateCreateCategory(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");

  return {
    name: text(payload.name, "name", { required: true, max: 120 }),
    description: text(payload.description, "description", { max: 300 }),
    sortOrder: integer(payload.sortOrder, "sortOrder", 0),
    active: boolean(payload.active, "active", true),
  };
}

export function validateUpdateCategory(payload) {
  return validateCreateCategory(payload);
}

export function validateCreateProduct(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados inválidos.");

  const hasPrice = payload.price !== undefined && payload.price !== null && payload.price !== "";
  const price = hasPrice ? Number(payload.price) : 0;
  if (!Number.isFinite(price) || price < 0 || price > 999999.99) invalid("Preço inválido.");

  const categoryId = payload.categoryId ? validateId(payload.categoryId) : null;
  const stockQuantity = payload.stockQuantity === undefined || payload.stockQuantity === ""
    ? 0
    : Number(payload.stockQuantity);

  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) invalid("Estoque inválido.");

  const pricingMode = payload.pricingMode === "variable" ? "variable" : "fixed";
  const priceConfigured = boolean(payload.priceConfigured, "priceConfigured", hasPrice);
  const availableDelivery = boolean(payload.availableDelivery, "availableDelivery", true);
  const availableInternal = boolean(payload.availableInternal, "availableInternal", true);
  const featured = boolean(payload.featured, "featured", false);
  const active = boolean(payload.active, "active", true);

  if (availableDelivery && pricingMode === "variable") {
    invalid("Produtos pesados não podem entrar no cardápio de delivery.");
  }
  if (availableDelivery && !priceConfigured) {
    invalid("Defina o preço antes de disponibilizar o produto no delivery.");
  }
  if (featured && !availableDelivery) {
    invalid("Somente produtos do delivery podem ser exibidos em destaque no site.");
  }
  if (active && !availableDelivery && !availableInternal) {
    invalid("Selecione ao menos um cardápio para o produto disponível.");
  }

  return {
    categoryId,
    name: text(payload.name, "name", { required: true, max: 140 }),
    description: text(payload.description, "description", { max: 500 }),
    price: Number(price.toFixed(2)),
    priceConfigured,
    unit: text(payload.unit, "unit", { max: 20 }) || "un",
    imagePath: text(payload.imagePath, "imagePath", { max: 500 }),
    featured,
    active,
    stockControl: boolean(payload.stockControl, "stockControl", false),
    stockQuantity,
    sortOrder: integer(payload.sortOrder, "sortOrder", 0),
    pricingMode,
    availableDelivery,
    availableInternal,
  };
}

export function validateUpdateProduct(payload) {
  return validateCreateProduct(payload);
}
