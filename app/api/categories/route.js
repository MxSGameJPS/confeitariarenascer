import { listCategoriesController } from "@/src/modules/catalog/catalog.controller";
import { validateListCategories } from "@/src/modules/catalog/catalog.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    const input = validateListCategories();
    return await listCategoriesController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
