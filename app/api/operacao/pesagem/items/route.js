import { PERMISSIONS } from "@/src/config/permissions";
import { registerStaffWeighingItemController } from "@/src/modules/weighing/weighing.controller";
import { validateStaffWeighingItem } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    const input = validateStaffWeighingItem(await request.json());
    return await registerStaffWeighingItemController(input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
