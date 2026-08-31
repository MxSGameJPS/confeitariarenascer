import { requireBridgeDevice } from "@/src/modules/bridge/bridge.auth";
import { updateBridgeDispatchStatusController } from "@/src/modules/bridge/bridge.controller";
import { validateBridgeDispatchId, validateBridgeDispatchStatus } from "@/src/modules/bridge/bridge.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const device = await requireBridgeDevice(request);
    const { id } = await params;
    return await updateBridgeDispatchStatusController(
      validateBridgeDispatchId(id),
      validateBridgeDispatchStatus(await request.json()),
      device
    );
  } catch (error) {
    return handleApiError(error);
  }
}
