import { PERMISSIONS } from "@/src/config/permissions";
import { updateBridgeDeviceController } from "@/src/modules/bridge/bridge.controller";
import { validateBridgeDeviceId, validateUpdateBridgeDevice } from "@/src/modules/bridge/bridge.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.BRIDGE_MANAGE, "admin");
    const { id } = await params;
    return await updateBridgeDeviceController(
      validateBridgeDeviceId(id),
      validateUpdateBridgeDevice(await request.json()),
      actor
    );
  } catch (error) {
    return handleApiError(error);
  }
}
