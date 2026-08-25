import { successResponse } from "@/src/shared/http/api-response";
import { createExpenseService,getAdminViewService } from "@/src/modules/admin-operations/admin-operations.service";
export async function getAdminViewController(input){return successResponse(await getAdminViewService(input));}
export async function createExpenseController(input,actor){return successResponse(await createExpenseService(input,actor),201);}
