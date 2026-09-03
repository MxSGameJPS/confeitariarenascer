import { importGemasterCatalogController } from "@/src/modules/admin/catalog/admin-catalog.controller";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const actor = await requireAdminSession();
    const formData = await request.formData();
    return await importGemasterCatalogController(formData.get("file"), actor);
  } catch (error) {
    return handleApiError(error);
  }
}
