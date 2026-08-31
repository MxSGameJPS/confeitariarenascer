import { registerWeighingItemController } from "@/src/modules/weighing/weighing.controller";
import { requireWeighingDevice } from "@/src/modules/weighing/weighing.auth";
import { validateWeighingCommandNumber, validateWeighingItem } from "@/src/modules/weighing/weighing.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request, { params }) {
  try {
    const device = await requireWeighingDevice(request);
    const { orderNumber } = await params;
    const commandNumber = validateWeighingCommandNumber(orderNumber);
    const input = validateWeighingItem(await request.json());
    return await registerWeighingItemController(commandNumber, input, device);
  } catch (error) {
    return handleApiError(error);
  }
}
