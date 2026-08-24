import { getDeliveryTrackingController } from "@/src/modules/orders/orders.controller";
import { validateTrackingToken } from "@/src/modules/orders/orders.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    return await getDeliveryTrackingController(validateTrackingToken(token));
  } catch (error) {
    return handleApiError(error);
  }
}

