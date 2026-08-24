import { AppError } from "@/src/shared/errors/app-error";
import { getProductsService } from "@/src/modules/catalog/catalog.service";
import { createTableRequest, findPublicOrderProducts, findPublicTable } from "@/src/modules/table-orders/table-orders.repository";
const cents = (value) => Math.round(Number(value) * 100);
const amount = (value) => Number((value / 100).toFixed(2));
export async function getTableMenuService(token) {
  const table = await findPublicTable(token);
  if (!table || !table.active || !table.command_enabled) throw new AppError("Esta mesa não está recebendo pedidos no momento.", { statusCode: 404, code: "TABLE_UNAVAILABLE" });
  return { table: { tableNumber: table.table_number, seats: table.seats }, products: await getProductsService({}) };
}
export async function createTableOrderService(token, input) {
  const table = await findPublicTable(token);
  if (!table || !table.active || !table.command_enabled) throw new AppError("Esta mesa não está recebendo pedidos no momento.", { statusCode: 409, code: "TABLE_UNAVAILABLE" });
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
  return createTableRequest({ p_table_token: token, p_customer_name: input.customerName, p_notes: input.notes, p_items: items });
}
