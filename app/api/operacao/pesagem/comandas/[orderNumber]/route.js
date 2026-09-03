import { PERMISSIONS } from "@/src/config/permissions";
import { getOrOpenStaffWeighingCommandController } from "@/src/modules/weighing/weighing.controller";
import {
  validateStaffWeighingCommandOpen,
  validateWeighingCommandNumber,
} from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    const { orderNumber } = await params;
    const input = validateStaffWeighingCommandOpen(await request.json());
    return await getOrOpenStaffWeighingCommandController(
      validateWeighingCommandNumber(orderNumber),
      input,
      actor,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
