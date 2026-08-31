import { listWeighingProductsController } from "@/src/modules/weighing/weighing.controller";
import { requireWeighingDevice } from "@/src/modules/weighing/weighing.auth";
import { validateWeighingProductQuery } from "@/src/modules/weighing/weighing.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request) {
  try {
    await requireWeighingDevice(request);
    return await listWeighingProductsController(validateWeighingProductQuery(new URL(request.url).searchParams));
  } catch (error) {
    return handleApiError(error);
  }
}
