import { PERMISSIONS } from "@/src/config/permissions";
import { registerStaffCounterItemController } from "@/src/modules/weighing/weighing.controller";
import { validateStaffCounterItem } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    const input = validateStaffCounterItem(await request.json());
    return await registerStaffCounterItemController(input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
