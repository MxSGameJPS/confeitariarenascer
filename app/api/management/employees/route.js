import {
  createEmployeeController,
  listEmployeesController,
} from "@/src/modules/employees/employees.controller";
import { validateCreateEmployee } from "@/src/modules/employees/employees.validation";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

function getSurface(request) {
  const value = request.headers.get("x-renascer-surface");
  return value === "admin" || value === "staff" ? value : null;
}

export async function GET(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.EMPLOYEES_VIEW, getSurface(request));
    return await listEmployeesController(actor);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.EMPLOYEES_CREATE, getSurface(request));
    const input = validateCreateEmployee(await request.json());
    return await createEmployeeController(input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
