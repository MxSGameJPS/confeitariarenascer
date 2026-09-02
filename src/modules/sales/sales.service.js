import { AppError } from "@/src/shared/errors/app-error";
import {
  addCommandItems,
  acceptDelivery,
  advanceDelivery,
  acceptCommandRequest,
  cancelSale,
  closeCommand,
  createOperationalSale,
  findProductsForSale,
  linkCommandToTable,
  listOperationalSales,
  openCounterCommand,
  rejectCommandRequest,
} from "@/src/modules/sales/sales.repository";

const cents = (value) => Math.round(Number(value) * 100);
const amount = (value) => Number((value / 100).toFixed(2));
const actorPayload = (actor) => ({ p_actor_kind: actor.kind === "admin" ? "admin" : "employee", p_actor_id: actor.id });

async function prepareOperationalItems(inputItems) {
  const ids = [...new Set(inputItems.map((item) => item.productId).filter(Boolean))];
  const products = ids.length ? await findProductsForSale(ids) : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  if (ids.some((id) => !byId.has(id))) throw new AppError("Um ou mais produtos não estão disponíveis.", { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
  let subtotalCents = 0;
  const items = inputItems.map((item) => {
    if (!item.productId) { const unitCents = cents(item.unitPrice); const itemCents = unitCents * item.quantity; subtotalCents += itemCents; return { product_id: null, product_name: item.name, unit_price: amount(unitCents), quantity: item.quantity, subtotal: amount(itemCents), pricing_mode: "fixed" }; }
    const product = byId.get(item.productId);
    const unitCents = product.pricing_mode === "variable" ? cents(item.unitPrice) : cents(product.price);
    if (product.pricing_mode === "variable" && (!item.unitPrice || item.unitPrice <= 0)) throw new AppError(`Informe o valor pesado de ${product.name}.`, { statusCode: 400, code: "VARIABLE_PRICE_REQUIRED" });
    if (product.stock_control && Number(product.stock_quantity) < item.quantity) throw new AppError(`Estoque insuficiente para ${product.name}.`, { statusCode: 409, code: "INSUFFICIENT_STOCK" });
    const itemCents = unitCents * item.quantity; subtotalCents += itemCents;
    return { product_id: product.id, product_name: product.name, unit_price: amount(unitCents), quantity: item.quantity, subtotal: amount(itemCents), pricing_mode: product.pricing_mode };
  });
  return { items, subtotalCents };
}

function mapSale(sale) {
  return {
    ...sale,
    subtotal: Number(sale.subtotal),
    delivery_fee: Number(sale.delivery_fee),
    total: Number(sale.total),
    items: (sale.items ?? []).map((item) => ({ ...item, unit_price: Number(item.unit_price), subtotal: Number(item.subtotal) })),
    payments: (sale.payments ?? []).map((payment) => ({ ...payment, amount: Number(payment.amount) })),
  };
}

export async function listSalesService(filters) {
  return (await listOperationalSales(filters)).map(mapSale);
}

export async function createOperationalSaleService(input, actor) {
  const { items, subtotalCents } = await prepareOperationalItems(input.items);

  const total = amount(subtotalCents);
  const paidCents = input.payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
  if (input.channel === "pos" && paidCents !== subtotalCents) {
    throw new AppError("Os pagamentos devem totalizar exatamente a venda.", { statusCode: 400, code: "PAYMENT_TOTAL_MISMATCH" });
  }
  if (input.changeFor !== null && input.payments.some((payment) => payment.method !== "dinheiro")) {
    throw new AppError("Troco só pode ser informado em pagamento integral em dinheiro.", { statusCode: 400, code: "INVALID_CHANGE_AMOUNT" });
  }
  if (input.changeFor !== null && cents(input.changeFor) < subtotalCents) {
    throw new AppError("O valor para troco é menor que o total.", { statusCode: 400, code: "INVALID_CHANGE_AMOUNT" });
  }

  return createOperationalSale({
    p_sale: { channel: input.channel, subtotal: total, total, command_label: input.commandLabel, notes: input.notes, change_for: input.changeFor },
    p_items: items,
    p_payments: input.payments,
    ...actorPayload(actor),
  });
}

export async function openCounterCommandService(input, actor) {
  return openCounterCommand({
    p_command_label: input.commandLabel,
    p_operation_key: input.operationId,
    ...actorPayload(actor),
  });
}

export async function linkCommandToTableService(orderId, input, actor) {
  return linkCommandToTable({
    p_order_id: orderId,
    p_table_id: input.tableId,
    p_operation_key: input.operationId,
    ...actorPayload(actor),
  });
}

export async function addCommandItemsService(id, inputItems, actor) {
  const { items } = await prepareOperationalItems(inputItems);
  return addCommandItems({ p_order_id: id, p_items: items, ...actorPayload(actor) });
}

export async function acceptDeliveryService(id, variablePrices, actor) {
  return acceptDelivery({
    p_order_id: id,
    p_variable_prices: variablePrices.map((item) => ({ item_id: item.itemId, unit_price: item.unitPrice })),
    ...actorPayload(actor),
  });
}

export async function advanceDeliveryService(id, nextStatus, actor) {
  return advanceDelivery({ p_order_id: id, p_next_status: nextStatus, ...actorPayload(actor) });
}

export async function closeCommandService(id, payments, actor) {
  return closeCommand({ p_order_id: id, p_payments: payments, ...actorPayload(actor) });
}

export async function cancelSaleService(id, input, actor) {
  return cancelSale({ p_order_id: id, p_item_id: input.itemId, p_reason: input.reason, ...actorPayload(actor) });
}

export async function acceptCommandRequestService(requestId, variablePrices, actor) {
  return acceptCommandRequest({
    p_request_id: requestId,
    p_variable_prices: variablePrices.map((item) => ({ item_id: item.itemId, unit_price: item.unitPrice })),
    ...actorPayload(actor),
  });
}
export async function rejectCommandRequestService(requestId, reason, actor) {
  return rejectCommandRequest({ p_request_id: requestId, p_reason: reason, ...actorPayload(actor) });
}
