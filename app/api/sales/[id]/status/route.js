import { PERMISSIONS } from "@/src/config/permissions";
import { advanceDeliveryController } from "@/src/modules/sales/sales.controller";
import { validateDeliveryStatus, validateSaleId } from "@/src/modules/sales/sales.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

function surface(request) {
  const value = request.headers.get("x-renascer-surface");
  return value === "admin" || value === "staff" ? value : null;
}

export async function POST(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.DELIVERY_ACCEPT, surface(request));
    const { id } = await params;
    const payload = await request.json();
    return await advanceDeliveryController(validateSaleId(id), validateDeliveryStatus(payload), actor);
  } catch (error) {
    return handleApiError(error);
  }
}

