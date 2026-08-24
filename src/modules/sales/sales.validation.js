import { AppError } from "@/src/shared/errors/app-error";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS = new Set(["pos", "comanda"]);
const PAYMENT_METHODS = new Set(["dinheiro", "pix", "credito", "debito"]);

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" });
}

function uuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) invalid(`${label} inválido.`);
  return value;
}

function money(value, label, { allowZero = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) invalid(`${label} inválido.`);
  return Number(parsed.toFixed(2));
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid(`${label} inválido.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) invalid(`${label} excede ${maxLength} caracteres.`);
  return normalized || null;
}

export function validateSaleId(value) {
  return uuid(value, "Venda");
}

export function validateCreateOperationalSale(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados da venda inválidos.");
  if (!CHANNELS.has(payload.channel)) invalid("Canal da venda inválido.");
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    invalid("Informe de 1 a 50 itens.");
  }

  const items = payload.items.map((item, index) => {
    if (!item || typeof item !== "object") invalid(`Item ${index + 1} inválido.`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) invalid(`Quantidade do item ${index + 1} inválida.`);

    if (item.productId) {
      return {
        productId: uuid(item.productId, `Produto do item ${index + 1}`),
        quantity,
        unitPrice: item.unitPrice == null ? null : money(item.unitPrice, `Preço do item ${index + 1}`),
      };
    }

    const name = optionalText(item.name, `Descrição do item ${index + 1}`, 160);
    if (!name || name.length < 2) invalid(`Informe a descrição do item ${index + 1}.`);
    return {
      productId: null,
      name,
      unitPrice: money(item.unitPrice, `Preço do item ${index + 1}`),
      quantity,
    };
  });

  const payments = payload.payments ?? [];
  if (!Array.isArray(payments) || payments.length > 4) invalid("Pagamentos inválidos.");
  const normalizedPayments = payments.map((payment) => {
    if (!payment || !PAYMENT_METHODS.has(payment.method)) invalid("Forma de pagamento inválida.");
    return { method: payment.method, amount: money(payment.amount, "Valor do pagamento") };
  });

  if (payload.channel === "pos" && normalizedPayments.length === 0) invalid("A venda no caixa precisa de pagamento.");
  if (payload.channel === "comanda" && normalizedPayments.length > 0) invalid("A comanda deve ser paga somente no fechamento.");

  const commandLabel = optionalText(payload.commandLabel, "Identificação da comanda", 80);
  if (payload.channel === "comanda" && !commandLabel) invalid("Identifique a mesa ou comanda.");

  return {
    channel: payload.channel,
    items,
    payments: normalizedPayments,
    commandLabel,
    notes: optionalText(payload.notes, "Observações", 500),
    changeFor: payload.changeFor == null || payload.changeFor === "" ? null : money(payload.changeFor, "Troco para"),
  };
}

export function validatePayments(payload) {
  if (!payload || !Array.isArray(payload.payments) || payload.payments.length === 0 || payload.payments.length > 4) {
    invalid("Informe os pagamentos.");
  }
  return payload.payments.map((payment) => {
    if (!payment || !PAYMENT_METHODS.has(payment.method)) invalid("Forma de pagamento inválida.");
    return { method: payment.method, amount: money(payment.amount, "Valor do pagamento") };
  });
}

export function validateCancellation(payload, { item = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Dados do cancelamento inválidos.");
  const reason = optionalText(payload.reason, "Motivo", 300);
  if (!reason || reason.length < 3) invalid("Informe o motivo do cancelamento.");
  return { reason, itemId: item ? uuid(payload.itemId, "Item") : null };
}

export function validateSalesFilters(searchParams) {
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const allowedChannels = new Set(["delivery", "pos", "comanda"]);
  return {
    channel: channel && allowedChannels.has(channel) ? channel : null,
    status: status && /^[a-z_]{3,30}$/.test(status) ? status : null,
  };
}

export function validateAcceptCommandRequest(payload) {
  const prices = payload?.variablePrices ?? [];
  if (!Array.isArray(prices) || prices.length > 50) invalid("Preços de pesagem inválidos.");
  return prices.map((item) => ({
    itemId: uuid(item?.itemId, "Item pesado"),
    unitPrice: money(item?.unitPrice, "Valor do item pesado"),
  }));
}
