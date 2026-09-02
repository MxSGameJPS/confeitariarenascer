import { successResponse } from "@/src/shared/http/api-response";
import {
  addCommandItemsService,
  acceptDeliveryService,
  advanceDeliveryService,
  acceptCommandRequestService,
  cancelSaleService,
  closeCommandService,
  createOperationalSaleService,
  linkCommandToTableService,
  listSalesService,
  openCounterCommandService,
  rejectCommandRequestService,
} from "@/src/modules/sales/sales.service";

export async function listSalesController(filters) { return successResponse(await listSalesService(filters)); }
export async function createSaleController(input, actor) { return successResponse(await createOperationalSaleService(input, actor), 201); }
export async function openCounterCommandController(input, actor) { return successResponse(await openCounterCommandService(input, actor), 201); }
export async function linkCommandToTableController(id, input, actor) { return successResponse(await linkCommandToTableService(id, input, actor)); }
export async function acceptDeliveryController(id, prices, actor) { return successResponse(await acceptDeliveryService(id, prices, actor)); }
export async function advanceDeliveryController(id, nextStatus, actor) { return successResponse(await advanceDeliveryService(id, nextStatus, actor)); }
export async function closeCommandController(id, payments, actor) { return successResponse(await closeCommandService(id, payments, actor)); }
export async function cancelSaleController(id, input, actor) { return successResponse(await cancelSaleService(id, input, actor)); }
export async function acceptCommandRequestController(id, prices, actor) { return successResponse(await acceptCommandRequestService(id, prices, actor)); }
export async function rejectCommandRequestController(id, reason, actor) { return successResponse(await rejectCommandRequestService(id, reason, actor)); }
export async function addCommandItemsController(id, items, actor) { return successResponse(await addCommandItemsService(id, items, actor), 201); }
