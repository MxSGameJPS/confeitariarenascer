import { PERMISSIONS } from "@/src/config/permissions";
import { createWeighingDeviceController, listWeighingDevicesController } from "@/src/modules/weighing/weighing.controller";
import { validateCreateWeighingDevice } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    await requirePermissionSession(PERMISSIONS.WEIGHING_DEVICES_MANAGE, "admin");
    return await listWeighingDevicesController();
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.WEIGHING_DEVICES_MANAGE, "admin");
    return await createWeighingDeviceController(validateCreateWeighingDevice(await request.json()), actor);
  } catch (error) {
    return handleApiError(error);
  }
}
