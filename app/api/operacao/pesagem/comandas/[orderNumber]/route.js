import { PERMISSIONS } from "@/src/config/permissions";
import { getWeighingCommandController } from "@/src/modules/weighing/weighing.controller";
import { validateWeighingCommandNumber } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request, { params }) {
  try {
    await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    const { orderNumber } = await params;
    return await getWeighingCommandController(validateWeighingCommandNumber(orderNumber));
  } catch (error) {
    return handleApiError(error);
  }
}
