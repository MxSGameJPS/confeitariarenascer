import { getDeliverySettingsController } from "@/src/modules/store-settings/store-settings.controller";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    return await getDeliverySettingsController();
  } catch (error) {
    return handleApiError(error);
  }
}

