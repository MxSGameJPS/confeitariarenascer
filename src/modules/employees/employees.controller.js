import { successResponse } from "@/src/shared/http/api-response";
import {
  createEmployeeService,
  listEmployeesService,
  resetEmployeePasswordService,
  updateEmployeeService,
} from "@/src/modules/employees/employees.service";

export async function listEmployeesController(actor) {
  return successResponse(await listEmployeesService(actor));
}

export async function createEmployeeController(input, actor) {
  return successResponse(await createEmployeeService(input, actor), 201);
}

export async function updateEmployeeController(id, input, actor) {
  return successResponse(await updateEmployeeService(id, input, actor));
}

export async function resetEmployeePasswordController(id, input, actor) {
  return successResponse(await resetEmployeePasswordService(id, input, actor));
}
