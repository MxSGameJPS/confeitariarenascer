import { AppError } from "@/src/shared/errors/app-error";
import {
  createWeighingDevice,
  findOpenCommandByNumber,
  listWeighingDevices,
  listWeighingProducts,
  registerWeighingItem,
  updateWeighingDevice,
  writeWeighingAdminAudit,
} from "@/src/modules/weighing/weighing.repository";
import { generateWeighingDeviceToken, hashWeighingDeviceToken } from "@/src/modules/weighing/weighing.auth";

export async function listWeighingProductsService(query = "") {
  const normalized = query.toLocaleLowerCase("pt-BR");
  return (await listWeighingProducts())
    .filter((product) => !normalized || product.name.toLocaleLowerCase("pt-BR").includes(normalized) || String(product.weighing_code || "").toLocaleLowerCase("pt-BR").includes(normalized))
    .map((product) => ({
      id: product.id,
      name: product.name,
      code: product.weighing_code,
      unit: product.unit,
      pricePerKg: Number(product.price),
    }));
}

export async function getWeighingCommandService(orderNumber) {
  const command = await findOpenCommandByNumber(orderNumber);
  if (!command) throw new AppError("Comanda não encontrada ou já encerrada.", { statusCode: 404, code: "COMMAND_NOT_FOUND" });
  return { ...command, total: Number(command.total) };
}

export async function registerWeighingItemService(orderNumber, input, device) {
  const result = await registerWeighingItem({
    p_order_number: orderNumber,
    p_product_id: input.productId,
    p_weight_kg: input.weightKg,
    p_operation_key: input.operationId,
    p_device_id: device.id,
  });
  return {
    ...result,
    weight_kg: Number(result.weight_kg),
    price_per_kg: Number(result.price_per_kg),
    item_total: Number(result.item_total),
    order_total: Number(result.order_total),
  };
}

export async function listWeighingDevicesService() {
  return listWeighingDevices();
}

export async function createWeighingDeviceService(input, actor) {
  const token = generateWeighingDeviceToken();
  const device = await createWeighingDevice({
    name: input.name,
    token_hash: hashWeighingDeviceToken(token),
    active: true,
    created_by_admin_id: actor.id,
  });
  await writeWeighingAdminAudit(actor.id, "weighing_device.created", device.id, { name: device.name });
  return { ...device, token };
}

export async function updateWeighingDeviceService(id, input, actor) {
  const device = await updateWeighingDevice(id, { active: input.active });
  if (!device) throw new AppError("Dispositivo não encontrado.", { statusCode: 404, code: "WEIGHING_DEVICE_NOT_FOUND" });
  await writeWeighingAdminAudit(actor.id, input.active ? "weighing_device.enabled" : "weighing_device.revoked", id, { name: device.name });
  return device;
}
