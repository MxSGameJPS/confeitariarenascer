import { successResponse } from "@/src/shared/http/api-response";
import {
  confirmBridgeSettlementService,
  createBridgeDeviceService,
  listBridgeDevicesService,
  listGemasterMappingsService,
  resolveBridgeCodeService,
  updateBridgeDeviceService,
  updateBridgeDispatchStatusService,
  upsertGemasterMappingService,
} from "@/src/modules/bridge/bridge.service";

export async function resolveBridgeCodeController(input, device) {
  return successResponse(await resolveBridgeCodeService(input, device), 201);
}

export async function updateBridgeDispatchStatusController(id, input, device) {
  return successResponse(await updateBridgeDispatchStatusService(id, input, device));
}

export async function confirmBridgeSettlementController(id, input, device) {
  return successResponse(await confirmBridgeSettlementService(id, input, device));
}

export async function listBridgeDevicesController() {
  return successResponse(await listBridgeDevicesService());
}

export async function createBridgeDeviceController(input, actor) {
  return successResponse(await createBridgeDeviceService(input, actor), 201);
}

export async function updateBridgeDeviceController(id, input, actor) {
  return successResponse(await updateBridgeDeviceService(id, input, actor));
}

export async function listGemasterMappingsController() {
  return successResponse(await listGemasterMappingsService());
}

export async function upsertGemasterMappingController(input, actor) {
  return successResponse(await upsertGemasterMappingService(input, actor));
}
