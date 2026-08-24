import { createOrderService, getDeliveryTrackingService } from "@/src/modules/orders/orders.service";
import { successResponse } from "@/src/shared/http/api-response";

export async function createOrderController(input) {
  const order = await createOrderService(input);
  return successResponse(order, 201);
}

export async function getDeliveryTrackingController(token) {
  return successResponse(await getDeliveryTrackingService(token));
}

