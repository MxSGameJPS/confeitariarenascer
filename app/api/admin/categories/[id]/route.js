import {
  archiveCategoryController,
  updateCategoryController,
} from "@/src/modules/admin/catalog/admin-catalog.controller";
import {
  validateId,
  validateUpdateCategory,
} from "@/src/modules/admin/catalog/admin-catalog.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { id } = await params;
    const categoryId = validateId(id);
    const input = validateUpdateCategory(await request.json());
    return await updateCategoryController(categoryId, input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { id } = await params;
    const categoryId = validateId(id);
    return await archiveCategoryController(categoryId, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
