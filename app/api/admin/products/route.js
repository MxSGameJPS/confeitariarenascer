import { createProductController } from "@/src/modules/admin/catalog/admin-catalog.controller";
import { validateCreateProduct } from "@/src/modules/admin/catalog/admin-catalog.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const actor = await requireAdminSession();
    const input = validateCreateProduct(await request.json());
    return await createProductController(input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
