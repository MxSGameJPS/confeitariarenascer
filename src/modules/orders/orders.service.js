import {
  createOrderTransaction,
  findDeliveryByTrackingToken,
  findActiveProductsByIds,
  getStoreSettings,
} from "@/src/modules/orders/orders.repository";
import { AppError } from "@/src/shared/errors/app-error";

const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (value) => Number((value / 100).toFixed(2));

export async function createOrderService(input) {
  const settings = await getStoreSettings();

  if (!settings) {
    throw new AppError("Configuração da loja não encontrada.", {
      statusCode: 503,
      code: "STORE_NOT_CONFIGURED",
    });
  }

  if (!settings.accepts_orders) {
    throw new AppError("A loja não está recebendo pedidos no momento.", {
      statusCode: 503,
      code: "ORDERS_DISABLED",
    });
  }

  const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await findActiveProductsByIds(uniqueProductIds);
  const productsById = new Map(products.map((product) => [product.id, product]));

  const missingProductIds = uniqueProductIds.filter((id) => !productsById.has(id));
  if (missingProductIds.length) {
    throw new AppError("Um ou mais produtos não estão disponíveis.", {
      statusCode: 409,
      code: "PRODUCT_UNAVAILABLE",
      details: { productIds: missingProductIds },
    });
  }

  let subtotalCents = 0;
  const normalizedItems = input.items.map((item) => {
    const product = productsById.get(item.productId);
    const unitPriceCents = toCents(product.price);
    const itemSubtotalCents = unitPriceCents * item.quantity;
    subtotalCents += itemSubtotalCents;

    return {
      product_id: product.id,
      product_name: product.name,
      unit_price: fromCents(unitPriceCents),
      quantity: item.quantity,
      subtotal: fromCents(itemSubtotalCents),
      pricing_mode: "fixed",
    };
  });

  const minimumOrderCents = toCents(settings.minimum_order || 0);
  if (subtotalCents < minimumOrderCents) {
    throw new AppError(
      `Pedido mínimo de R$ ${fromCents(minimumOrderCents).toFixed(2).replace(".", ",")}.`,
      {
        statusCode: 409,
        code: "MINIMUM_ORDER_NOT_REACHED",
      }
    );
  }

  const deliveryFeeCents =
    input.fulfillmentType === "entrega" ? toCents(settings.delivery_fee || 0) : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  if (input.changeFor !== null && toCents(input.changeFor) < totalCents) {
    throw new AppError("O valor informado para troco é menor que o total do pedido.", {
      statusCode: 400,
      code: "INVALID_CHANGE_AMOUNT",
    });
  }

  const order = await createOrderTransaction({
    customer: input.customer,
    order: {
      fulfillment_type: input.fulfillmentType,
      payment_method: input.paymentMethod,
      subtotal: fromCents(subtotalCents),
      delivery_fee: fromCents(deliveryFeeCents),
      total: fromCents(totalCents),
      change_for: input.changeFor,
      address: input.address,
      notes: input.notes,
    },
    items: normalizedItems,
  });

  return {
    ...order,
    subtotal: fromCents(subtotalCents),
    delivery_fee: fromCents(deliveryFeeCents),
    total: fromCents(totalCents),
  };
}

export async function getDeliveryTrackingService(token) {
  const order = await findDeliveryByTrackingToken(token);
  if (!order) {
    throw new AppError("Pedido não encontrado.", { statusCode: 404, code: "ORDER_NOT_FOUND" });
  }
  return {
    ...order,
    subtotal: Number(order.subtotal),
    delivery_fee: Number(order.delivery_fee),
    total: Number(order.total),
    items: (order.items ?? []).map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
  };
}

