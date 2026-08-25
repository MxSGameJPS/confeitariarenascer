import { successResponse } from "@/src/shared/http/api-response";
import { createTableOrderService, getTableCustomerSessionService, getTableMenuService, openTableCustomerSessionService } from "@/src/modules/table-orders/table-orders.service";
export async function getTableMenuController(token) { return successResponse(await getTableMenuService(token)); }
export async function createTableOrderController(token, input, rawToken) { return successResponse(await createTableOrderService(token, input, rawToken), 201); }
export async function getTableCustomerSessionController(token, rawToken) { return successResponse(await getTableCustomerSessionService(token, rawToken)); }
export async function openTableCustomerSessionController(token, input) { return openTableCustomerSessionService(token, input); }
