import { listProductsController } from "@/src/modules/catalog/catalog.controller";
import { validateListProducts } from "@/src/modules/catalog/catalog.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request) {
  try {
    const input = validateListProducts(new URL(request.url).searchParams);
    return await listProductsController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
