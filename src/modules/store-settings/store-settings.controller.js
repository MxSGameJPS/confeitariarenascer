import { successResponse } from "@/src/shared/http/api-response";
import { getDeliverySettingsService, updateDeliverySettingsService } from "./store-settings.service";

export async function getDeliverySettingsController() {
  return successResponse(await getDeliverySettingsService());
}

export async function updateDeliverySettingsController(input, actor) {
  return successResponse(await updateDeliverySettingsService(input, actor));
}

