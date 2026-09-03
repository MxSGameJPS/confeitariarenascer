import { PERMISSIONS } from "@/src/config/permissions";
import { getStaffWeighingProductController } from "@/src/modules/weighing/weighing.controller";
import { validateWeighingProductCode } from "@/src/modules/weighing/weighing.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request) {
  try {
    await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    const { searchParams } = new URL(request.url);
    return await getStaffWeighingProductController(
      validateWeighingProductCode(searchParams.get("code"))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
