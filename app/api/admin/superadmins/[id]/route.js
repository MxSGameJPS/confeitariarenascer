import { deactivateSuperadminController } from "@/src/modules/superadmins/superadmins.controller";
import { validateSuperadminId } from "@/src/modules/superadmins/superadmins.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function DELETE(_request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { id } = await params;
    return await deactivateSuperadminController(validateSuperadminId(id), actor);
  } catch (error) {
    return handleApiError(error);
  }
}
