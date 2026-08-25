import { AppError } from "@/src/shared/errors/app-error";
import { getProductsService } from "@/src/modules/catalog/catalog.service";
import { createCustomerSession, createTableRequest, findCustomerSessionByHash, findOpenTableOrder, findPublicOrderProducts, findPublicTable, listCustomerRequests, touchCustomerSession } from "@/src/modules/table-orders/table-orders.repository";
import { createTableCustomerToken, hashTableCustomerToken } from "@/src/modules/table-orders/table-orders.cookies";
const cents = (value) => Math.round(Number(value) * 100);
const amount = (value) => Number((value / 100).toFixed(2));
export async function getTableMenuService(token) {
  const table = await findPublicTable(token);
  if (!table || !table.active || !table.command_enabled) throw new AppError("Esta mesa não está recebendo pedidos no momento.", { statusCode: 404, code: "TABLE_UNAVAILABLE" });
  const products = await getProductsService({ channel: "internal" });
  const categories = [...new Map(products.filter((product) => product.category).map((product) => [product.category.id, product.category])).values()];
  return { table: { tableNumber: table.table_number, seats: table.seats }, categories, products };
}
export async function openTableCustomerSessionService(token, input) {
  const table = await findPublicTable(token);
  if (!table || !table.active || !table.command_enabled) throw new AppError("Esta mesa não está recebendo pedidos no momento.", { statusCode: 409, code: "TABLE_UNAVAILABLE" });
  const rawToken = createTableCustomerToken();
  const openOrder = await findOpenTableOrder(table.id);
  const session = await createCustomerSession({
    table_id: table.id,
    order_id: openOrder?.id ?? null,
    customer_name: input.name,
    customer_whatsapp: input.whatsapp,
    access_token_hash: hashTableCustomerToken(rawToken),
  });
  return { session, rawToken };
}
export async function getTableCustomerSessionService(token, rawToken) {
  const table = await findPublicTable(token);
  if (!table || !rawToken) return null;
  const session = await findCustomerSessionByHash(hashTableCustomerToken(rawToken), table.id);
  if (!session) return null;
  await touchCustomerSession(session.id);
  const requests = await listCustomerRequests(session.id);
  return {
    id: session.id, name: session.customer_name, whatsapp: session.customer_whatsapp,
    status: session.status, joinedAt: session.joined_at, closedAt: session.closed_at,
    requests: requests.map((request) => ({ ...request, items: (request.items ?? []).map((item) => ({ ...item, unit_price: Number(item.unit_price), subtotal: Number(item.subtotal) })) })),
  };
}
export async function createTableOrderService(token, input, rawToken) {
  const table = await findPublicTable(token);
  if (!table || !table.active || !table.command_enabled) throw new AppError("Esta mesa não está recebendo pedidos no momento.", { statusCode: 409, code: "TABLE_UNAVAILABLE" });
  if (!rawToken) throw new AppError("Identifique-se novamente para fazer o pedido.", { statusCode: 401, code: "TABLE_SESSION_REQUIRED" });
  const session = await findCustomerSessionByHash(hashTableCustomerToken(rawToken), table.id);
  if (!session || session.status !== "ativo") throw new AppError("Sua sessão nesta mesa foi encerrada.", { statusCode: 401, code: "TABLE_SESSION_EXPIRED" });
  const ids = [...new Set(input.items.map((item) => item.productId))];
  const products = await findPublicOrderProducts(ids);
  const byId = new Map(products.map((product) => [product.id, product]));
  if (ids.some((id) => !byId.has(id))) throw new AppError("Um ou mais produtos não estão disponíveis.", { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
  const items = input.items.map((item) => {
    const product = byId.get(item.productId);
    const variable = product.pricing_mode === "variable";
    const unit = variable ? 0 : cents(product.price);
    return { product_id: product.id, product_name: product.name, unit_price: amount(unit), quantity: item.quantity, subtotal: amount(unit * item.quantity), pricing_mode: variable ? "variable" : "fixed" };
  });
  return createTableRequest({ p_table_token: token, p_customer_session_id: session.id, p_notes: input.notes, p_items: items });
}

