import { PERMISSIONS } from "@/src/config/permissions";
import { updateWeighingDeviceController } from "@/src/modules/weighing/weighing.controller";
import { validateUpdateWeighingDevice, validateWeighingDeviceId } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.WEIGHING_DEVICES_MANAGE, "admin");
    const { id } = await params;
    return await updateWeighingDeviceController(
      validateWeighingDeviceId(id),
      validateUpdateWeighingDevice(await request.json()),
      actor
    );
  } catch (error) {
    return handleApiError(error);
  }
}
