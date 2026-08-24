import { successResponse } from "@/src/shared/http/api-response";
import { createTableOrderService, getTableMenuService } from "@/src/modules/table-orders/table-orders.service";
export async function getTableMenuController(token) { return successResponse(await getTableMenuService(token)); }
export async function createTableOrderController(token, input) { return successResponse(await createTableOrderService(token, input), 201); }
