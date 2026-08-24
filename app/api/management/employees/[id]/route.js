import { updateEmployeeController } from "@/src/modules/employees/employees.controller";
import {
  validateEmployeeId,
  validateUpdateEmployee,
} from "@/src/modules/employees/employees.validation";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function PATCH(request, { params }) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.EMPLOYEES_UPDATE);
    const { id } = await params;
    const employeeId = validateEmployeeId(id);
    const input = validateUpdateEmployee(await request.json());
    return await updateEmployeeController(employeeId, input, actor);
  } catch (error) {
    return handleApiError(error);
  }
}
