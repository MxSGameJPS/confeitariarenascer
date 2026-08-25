import { PERMISSIONS } from "@/src/config/permissions";
import { createExpenseController,getAdminViewController } from "@/src/modules/admin-operations/admin-operations.controller";
import { validateAdminView,validateExpense } from "@/src/modules/admin-operations/admin-operations.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
export async function GET(request){try{const input=validateAdminView(request.nextUrl.searchParams);const permission=input.view==="audit"?PERMISSIONS.AUDIT_VIEW:PERMISSIONS.REPORTS_VIEW;await requirePermissionSession(permission,"admin");return getAdminViewController(input);}catch(error){return handleApiError(error);}}
export async function POST(request){try{const actor=await requirePermissionSession(PERMISSIONS.REPORTS_VIEW,"admin");return createExpenseController(validateExpense(await request.json()),actor);}catch(error){return handleApiError(error);}}
