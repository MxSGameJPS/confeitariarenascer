import {
  archiveProductController,
  updateProductController,
} from "@/src/modules/admin/catalog/admin-catalog.controller";
import {
  validateId,
  validateUpdateProduct,
} from "@/src/modules/admin/catalog/admin-catalog.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { id } = await params;
    const productId = validateId(id);
    const input = validateUpdateProduct(await request.json());
    return await updateProductController(productId, input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { id } = await params;
    const productId = validateId(id);
    return await archiveProductController(productId, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
