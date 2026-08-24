import { successResponse } from "@/src/shared/http/api-response";
import {
  acceptDeliveryService,
  acceptCommandRequestService,
  cancelSaleService,
  closeCommandService,
  createOperationalSaleService,
  listSalesService,
} from "@/src/modules/sales/sales.service";

export async function listSalesController(filters) { return successResponse(await listSalesService(filters)); }
export async function createSaleController(input, actor) { return successResponse(await createOperationalSaleService(input, actor), 201); }
export async function acceptDeliveryController(id, actor) { return successResponse(await acceptDeliveryService(id, actor)); }
export async function closeCommandController(id, payments, actor) { return successResponse(await closeCommandService(id, payments, actor)); }
export async function cancelSaleController(id, input, actor) { return successResponse(await cancelSaleService(id, input, actor)); }
export async function acceptCommandRequestController(id, prices, actor) { return successResponse(await acceptCommandRequestService(id, prices, actor)); }
