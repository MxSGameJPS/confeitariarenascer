import { AppError } from "@/src/shared/errors/app-error";

const PAYMENT_METHODS = new Set(["dinheiro", "pix", "credito", "debito"]);
const FULFILLMENT_TYPES = new Set(["entrega", "retirada"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message, details = null) {
  throw new AppError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    details,
  });
}

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    invalid(`Campo obrigatório: ${field}`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    invalid(`Campo ${field} excede o limite de ${maxLength} caracteres.`);
  }

  return normalized;
}

function optionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid(`Campo inválido: ${field}`);

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    invalid(`Campo ${field} excede o limite de ${maxLength} caracteres.`);
  }

  return normalized || null;
}

function normalizePhone(value) {
  const raw = requiredString(value, "customer.phone", 30);
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 13) {
    invalid("Telefone inválido.");
  }

  return digits;
}

export function validateCreateOrder(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados do pedido inválidos.");
  }

  const customer = payload.customer;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    invalid("Dados do cliente são obrigatórios.");
  }

  const fulfillmentType = payload.fulfillmentType;
  if (!FULFILLMENT_TYPES.has(fulfillmentType)) {
    invalid("Forma de recebimento inválida.");
  }

  const paymentMethod = payload.paymentMethod;
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    invalid("Forma de pagamento inválida.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    invalid("O pedido precisa ter pelo menos um item.");
  }

  if (payload.items.length > 50) {
    invalid("Quantidade máxima de itens diferentes excedida.");
  }

  const items = payload.items.map((item, index) => {
    if (!item || typeof item !== "object") {
      invalid(`Item inválido na posição ${index + 1}.`);
    }

    if (typeof item.productId !== "string" || !UUID_PATTERN.test(item.productId)) {
      invalid(`Produto inválido na posição ${index + 1}.`);
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      invalid(`Quantidade inválida na posição ${index + 1}.`);
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
    };
  });

  let address = null;
  if (fulfillmentType === "entrega") {
    const source = payload.address;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      invalid("Endereço é obrigatório para entrega.");
    }

    address = {
      street: requiredString(source.street, "address.street", 160),
      number: requiredString(source.number, "address.number", 30),
      neighborhood: requiredString(source.neighborhood, "address.neighborhood", 100),
      complement: optionalString(source.complement, "address.complement", 120),
      reference: optionalString(source.reference, "address.reference", 180),
    };
  }

  let changeFor = null;
  if (payload.changeFor !== undefined && payload.changeFor !== null && payload.changeFor !== "") {
    const parsed = Number(payload.changeFor);
    if (!Number.isFinite(parsed) || parsed <= 0) invalid("Valor para troco inválido.");
    changeFor = Number(parsed.toFixed(2));
  }

  if (paymentMethod !== "dinheiro" && changeFor !== null) {
    invalid("Troco só pode ser informado para pagamento em dinheiro.");
  }

  return {
    customer: {
      name: requiredString(customer.name, "customer.name", 120),
      phone: normalizePhone(customer.phone),
    },
    fulfillmentType,
    paymentMethod,
    changeFor,
    address,
    notes: optionalString(payload.notes, "notes", 500),
    items,
  };
}
