import { listAdminCatalogController } from "@/src/modules/admin/catalog/admin-catalog.controller";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    await requireAdminSession();
    return await listAdminCatalogController();
  } catch (error) {
    return handleApiError(error);
  }
}
