import { PERMISSIONS } from "@/src/config/permissions";
import { closeCommandController } from "@/src/modules/sales/sales.controller";
import { validatePayments, validateSaleId } from "@/src/modules/sales/sales.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }

export async function POST(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.COMMANDS_RECEIVE, surface(request));
    const { id } = await params;
    return await closeCommandController(validateSaleId(id), validatePayments(await request.json()), actor);
  } catch (error) { return handleApiError(error); }
}
