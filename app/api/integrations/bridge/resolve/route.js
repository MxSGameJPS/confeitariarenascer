import { requireBridgeDevice } from "@/src/modules/bridge/bridge.auth";
import { resolveBridgeCodeController } from "@/src/modules/bridge/bridge.controller";
import { validateBridgeResolve } from "@/src/modules/bridge/bridge.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const device = await requireBridgeDevice(request);
    return await resolveBridgeCodeController(validateBridgeResolve(await request.json()), device);
  } catch (error) {
    return handleApiError(error);
  }
}
