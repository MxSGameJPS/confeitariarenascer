import { searchOperationalProductsController } from "@/src/modules/catalog/catalog.controller";
import { validateOperationalProductSearch } from "@/src/modules/catalog/catalog.validation";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET(request) {
  try {
    const input = validateOperationalProductSearch(new URL(request.url).searchParams);
    const surface = request.headers.get("x-renascer-surface") === "admin" ? "admin" : "staff";
    const permission = input.context === "comanda"
      ? PERMISSIONS.COMMANDS_RECEIVE
      : PERMISSIONS.POS_ACCESS;

    await requirePermissionSession(permission, surface);
    return await searchOperationalProductsController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
