import {
  createSuperadminController,
  listSuperadminsController,
} from "@/src/modules/superadmins/superadmins.controller";
import { validateCreateSuperadmin } from "@/src/modules/superadmins/superadmins.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    const actor = await requireAdminSession();
    return await listSuperadminsController(actor);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await requireAdminSession();
    const input = validateCreateSuperadmin(await request.json());
    return await createSuperadminController(input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
