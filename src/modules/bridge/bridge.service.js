import { AppError } from "@/src/shared/errors/app-error";
import { generateBridgeDeviceToken, hashBridgeDeviceToken } from "@/src/modules/bridge/bridge.auth";
import {
  confirmBridgeSettlement,
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
    external_total: payload.external_total == null ? null : Number(payload.external_total),
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

function bridgeBusinessError(error, code) {
  const message = error?.message || "";
  if (message === "Pedido sem itens ativos") {
    return new AppError(`A comanda ${code} ainda não possui itens.`, { statusCode: 409, code: "BRIDGE_EMPTY_ORDER" });
  }
  if (message === "Comanda nao encontrada ou encerrada") {
    return new AppError(`A comanda ${code} não foi encontrada ou já está encerrada.`, { statusCode: 404, code: "BRIDGE_COMMAND_NOT_FOUND" });
  }
  if (message === "Comanda possui solicitacoes pendentes") {
    return new AppError(`A comanda ${code} ainda possui solicitações pendentes.`, { statusCode: 409, code: "BRIDGE_PENDING_REQUESTS" });
  }
  if (message === "Pedido possui itens ainda nao aceitos") {
    return new AppError(`${code} possui itens que ainda não foram aceitos pela equipe.`, { statusCode: 409, code: "BRIDGE_PENDING_ITEMS" });
  }
  if (message.startsWith("Produto sem mapeamento GeMaster:")) {
    return new AppError(message.replace("Produto sem mapeamento GeMaster:", "Produto sem código GeMaster:"), { statusCode: 409, code: "BRIDGE_PRODUCT_NOT_MAPPED" });
  }
  if (message.startsWith("Item sem produto vinculado:")) {
    return new AppError(`${message} O Bridge só envia produtos cadastrados e mapeados para o GeMaster.`, { statusCode: 409, code: "BRIDGE_MANUAL_ITEM_NOT_SUPPORTED" });
  }
  return error;
}

export async function resolveBridgeCodeService(input, device) {
  try {
    const result = await prepareBridgeDispatch({
      p_reference_code: input.code,
      p_operation_key: input.operationId,
      p_device_id: device.id,
    });
    return normalizeNumbers(result);
  } catch (error) {
    throw bridgeBusinessError(error, input.code);
  }
}

export async function updateBridgeDispatchStatusService(dispatchId, input, device) {
  return updateBridgeDispatchStatus({
    p_dispatch_id: dispatchId,
    p_device_id: device.id,
    p_status: input.status,
    p_error: input.error,
  });
}

export async function confirmBridgeSettlementService(dispatchId, input, device) {
  const result = await confirmBridgeSettlement({
    p_dispatch_id: dispatchId,
    p_device_id: device.id,
    p_operation_key: input.operationId,
    p_external_sale_id: input.externalSaleId,
    p_total: input.total,
    p_payment_method: input.paymentMethod,
    p_fiscal_document: input.fiscalDocument,
    p_completed_at: input.completedAt,
    p_metadata: input.metadata,
  });
  return normalizeNumbers(result);
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
