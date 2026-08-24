import { getDeliverySettingsController, updateDeliverySettingsController } from "@/src/modules/store-settings/store-settings.controller";
import { validateDeliverySettings } from "@/src/modules/store-settings/store-settings.validation";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    await requireAdminSession();
    return await getDeliverySettingsController();
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await requireAdminSession();
    return await updateDeliverySettingsController(validateDeliverySettings(await request.json()), actor);
  } catch (error) {
    return handleApiError(error);
  }
}

