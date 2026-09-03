import { successResponse } from "@/src/shared/http/api-response";
import {
  createWeighingDeviceService,
  getOrOpenStaffWeighingCommandService,
  getStaffWeighingProductService,
  getWeighingCommandService,
  listWeighingDevicesService,
  listWeighingProductsService,
  registerStaffWeighingItemService,
  registerWeighingItemService,
  updateWeighingDeviceService,
} from "@/src/modules/weighing/weighing.service";

export async function listWeighingProductsController(query) {
  return successResponse(await listWeighingProductsService(query));
}

export async function getWeighingCommandController(orderNumber) {
  return successResponse(await getWeighingCommandService(orderNumber));
}

export async function getOrOpenStaffWeighingCommandController(commandNumber, input, actor) {
  return successResponse(await getOrOpenStaffWeighingCommandService(commandNumber, input, actor));
}

export async function getStaffWeighingProductController(code) {
  return successResponse(await getStaffWeighingProductService(code));
}

export async function registerWeighingItemController(orderNumber, input, device) {
  return successResponse(await registerWeighingItemService(orderNumber, input, device), 201);
}

export async function registerStaffWeighingItemController(input, actor) {
  return successResponse(await registerStaffWeighingItemService(input, actor), 201);
}

export async function listWeighingDevicesController() {
  return successResponse(await listWeighingDevicesService());
}

export async function createWeighingDeviceController(input, actor) {
  return successResponse(await createWeighingDeviceService(input, actor), 201);
}

export async function updateWeighingDeviceController(id, input, actor) {
  return successResponse(await updateWeighingDeviceService(id, input, actor));
}
