import { createOrderController } from "@/src/modules/orders/orders.controller";
import { validateCreateOrder } from "@/src/modules/orders/orders.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const payload = await request.json();
    const input = validateCreateOrder(payload);
    return await createOrderController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
