import { uploadProductImageController } from "@/src/modules/admin/catalog/admin-catalog.controller";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const actor = await requireAdminSession();
    const formData = await request.formData();
    const file = formData.get("file");
    return await uploadProductImageController(file, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
