import { PERMISSIONS } from "@/src/config/permissions";
import { createSaleController, listSalesController } from "@/src/modules/sales/sales.controller";
import { validateCreateOperationalSale, validateSalesFilters } from "@/src/modules/sales/sales.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }

export async function GET(request) {
  try {
    await requirePermissionSession(PERMISSIONS.POS_ACCESS, surface(request));
    return await listSalesController(validateSalesFilters(request.nextUrl.searchParams));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request) {
  try {
    const input = validateCreateOperationalSale(await request.json());
    const permission = input.channel === "comanda" ? PERMISSIONS.COMMANDS_RECEIVE : PERMISSIONS.POS_SELL;
    const actor = await requirePermissionSession(permission, surface(request));
    return await createSaleController(input, actor);
  } catch (error) { return handleApiError(error); }
}
