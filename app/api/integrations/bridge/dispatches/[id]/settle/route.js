import { requireBridgeDevice } from "@/src/modules/bridge/bridge.auth";
import { confirmBridgeSettlementController } from "@/src/modules/bridge/bridge.controller";
import { validateBridgeDispatchId, validateBridgeSettlement } from "@/src/modules/bridge/bridge.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request, { params }) {
  try {
    const device = await requireBridgeDevice(request);
    const { id } = await params;
    return await confirmBridgeSettlementController(
      validateBridgeDispatchId(id),
      validateBridgeSettlement(await request.json()),
      device
    );
  } catch (error) {
    return handleApiError(error);
  }
}
