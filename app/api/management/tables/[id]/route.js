import { PERMISSIONS } from "@/src/config/permissions";
import { updateTableStatusController } from "@/src/modules/tables/tables.controller";
import { validateTableId, validateTableStatus } from "@/src/modules/tables/tables.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }
export async function PATCH(request, { params }) { try { const actor = await requirePermissionSession(PERMISSIONS.TABLES_STATUS, surface(request)); const { id } = await params; return await updateTableStatusController(validateTableId(id), validateTableStatus(await request.json()), actor); } catch (error) { return handleApiError(error); } }
