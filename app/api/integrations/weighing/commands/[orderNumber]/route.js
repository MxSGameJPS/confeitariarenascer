import { getWeighingCommandController } from "@/src/modules/weighing/weighing.controller";
import { requireWeighingDevice } from "@/src/modules/weighing/weighing.auth";
import { validateWeighingCommandNumber } from "@/src/modules/weighing/weighing.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request, { params }) {
  try {
    await requireWeighingDevice(request);
    const { orderNumber } = await params;
    return await getWeighingCommandController(validateWeighingCommandNumber(orderNumber));
  } catch (error) {
    return handleApiError(error);
  }
}
