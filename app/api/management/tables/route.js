import { PERMISSIONS } from "@/src/config/permissions";
import { createTableController, listTablesController } from "@/src/modules/tables/tables.controller";
import { validateCreateTable } from "@/src/modules/tables/tables.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }
export async function GET(request) { try { await requirePermissionSession(PERMISSIONS.TABLES_VIEW, surface(request)); return await listTablesController(); } catch (error) { return handleApiError(error); } }
export async function POST(request) { try { const actor = await requirePermissionSession(PERMISSIONS.TABLES_CREATE, surface(request)); return await createTableController(validateCreateTable(await request.json()), actor); } catch (error) { return handleApiError(error); } }
