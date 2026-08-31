import { AppError } from "@/src/shared/errors/app-error";
import { generateBridgeDeviceToken, hashBridgeDeviceToken } from "@/src/modules/bridge/bridge.auth";
import {
  createBridgeDevice,
  createGemasterMapping,
  findGemasterMapping,
  listBridgeDevices,
  listGemasterMappings,
  prepareBridgeDispatch,
  updateBridgeDevice,
  updateBridgeDispatchStatus,
  updateGemasterMapping,
  writeBridgeAdminAudit,
} from "@/src/modules/bridge/bridge.repository";

function normalizeNumbers(payload) {
  return {
    ...payload,
    total: payload.total == null ? null : Number(payload.total),
    subtotal: payload.subtotal == null ? null : Number(payload.subtotal),
    delivery_fee: payload.delivery_fee == null ? null : Number(payload.delivery_fee),
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          weight_kg: item.weight_kg == null ? null : Number(item.weight_kg),
          price_per_kg: item.price_per_kg == null ? null : Number(item.price_per_kg),
        }))
      : [],
  };
}

export async function resolveBridgeCodeService(input, device) {
  const result = await prepareBridgeDispatch({
    p_reference_code: input.code,
    p_operation_key: input.operationId,
    p_device_id: device.id,
  });
  return normalizeNumbers(result);
}

export async function updateBridgeDispatchStatusService(dispatchId, input, device) {
  return updateBridgeDispatchStatus({
    p_dispatch_id: dispatchId,
    p_device_id: device.id,
    p_status: input.status,
    p_error: input.error,
  });
}

export async function listBridgeDevicesService() {
  return listBridgeDevices();
}

export async function createBridgeDeviceService(input, actor) {
  const token = generateBridgeDeviceToken();
  const device = await createBridgeDevice({
    name: input.name,
    token_hash: hashBridgeDeviceToken(token),
    active: true,
    organization_id: input.organizationId,
    store_id: input.storeId,
    created_by_admin_id: actor.id,
  });
  await writeBridgeAdminAudit(actor.id, "bridge_device.created", "bridge_device", device.id, {
    name: device.name,
    organization_id: device.organization_id,
    store_id: device.store_id,
  });
  return { ...device, token };
}

export async function updateBridgeDeviceService(id, input, actor) {
  const device = await updateBridgeDevice(id, { active: input.active });
  if (!device) throw new AppError("Bridge não encontrado.", { statusCode: 404, code: "BRIDGE_DEVICE_NOT_FOUND" });
  await writeBridgeAdminAudit(
    actor.id,
    input.active ? "bridge_device.enabled" : "bridge_device.revoked",
    "bridge_device",
    id,
    { name: device.name }
  );
  return device;
}

export async function listGemasterMappingsService() {
  const { products, mappings } = await listGemasterMappings();
  return {
    products: products.map((product) => ({
      ...product,
      gemasterMappings: mappings.filter((mapping) => mapping.product_id === product.id),
    })),
  };
}

export async function upsertGemasterMappingService(input, actor) {
  const existing = await findGemasterMapping({
    productId: input.productId,
    organizationId: input.organizationId,
    storeId: input.storeId,
  });

  const payload = {
    product_id: input.productId,
    provider: "gemaster",
    organization_id: input.organizationId,
    store_id: input.storeId,
    external_code: input.externalCode,
    external_ean: input.externalEan,
    active: true,
  };

  const mapping = existing
    ? await updateGemasterMapping(existing.id, payload)
    : await createGemasterMapping(payload);

  await writeBridgeAdminAudit(actor.id, "gemaster_mapping.upserted", "product_external_mapping", mapping.id, {
    product_id: mapping.product_id,
    external_code: mapping.external_code,
    organization_id: mapping.organization_id,
    store_id: mapping.store_id,
  });
  return mapping;
}
