import { AppError } from "@/src/shared/errors/app-error";
import { getPublicStorageUrl } from "@/src/config/supabase/server";
import {
  createWeighingDevice,
  findOpenCommandByNumber,
  findOpenStaffCommandByPhysicalNumber,
  findWeighingProductByExternalCode,
  listWeighingDevices,
  listWeighingProducts,
  openStaffCounterCommand,
  registerStaffWeighingItem,
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

export async function getOrOpenStaffWeighingCommandService(commandNumber, input, actor) {
  let command = await findOpenStaffCommandByPhysicalNumber(commandNumber);
  let created = false;

  if (!command) {
    const opened = await openStaffCounterCommand({
      commandNumber,
      operationId: input.operationId,
      actor,
    });
    created = !opened?.duplicate;
    command = await findOpenStaffCommandByPhysicalNumber(commandNumber);
  }

  if (!command) {
    throw new AppError("Não foi possível iniciar a comanda de balcão.", {
      statusCode: 409,
      code: "COMMAND_OPEN_FAILED",
    });
  }

  return {
    ...command,
    command_number: commandNumber,
    command_code: `C${commandNumber}`,
    total: Number(command.total),
    created,
  };
}

export async function getStaffWeighingProductService(identifier) {
  const result = await findWeighingProductByExternalCode(identifier);

  if (result?.ambiguous) {
    throw new AppError(
      `A referência ${identifier} está vinculada a mais de um produto. Use o código GeMaster para identificar o item.`,
      { statusCode: 409, code: "WEIGHING_PRODUCT_REFERENCE_AMBIGUOUS" },
    );
  }

  if (!result?.product) {
    throw new AppError("Produto não encontrado pelo código ou referência informada.", { statusCode: 404, code: "WEIGHING_PRODUCT_NOT_FOUND" });
  }

  const { product, mapping, matchedBy } = result;
  if (!product.active || !product.available_internal) {
    throw new AppError("Produto indisponível para venda interna.", { statusCode: 409, code: "WEIGHING_PRODUCT_UNAVAILABLE" });
  }
  if (product.pricing_mode !== "variable") {
    throw new AppError("Este produto não está configurado para venda por peso.", { statusCode: 409, code: "WEIGHING_PRODUCT_NOT_VARIABLE" });
  }
  if (product.price_configured === false || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
    throw new AppError("Preço por kg ainda não configurado para este produto.", { statusCode: 409, code: "WEIGHING_PRICE_PENDING" });
  }

  return {
    id: product.id,
    name: product.name,
    code: mapping.external_code || product.weighing_code,
    reference: mapping.external_reference || mapping.external_ean || null,
    matchedBy,
    pricePerKg: Number(product.price),
    unit: product.unit || "kg",
    imageUrl: getPublicStorageUrl(product.image_path),
  };
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

export async function registerStaffWeighingItemService(input, actor) {
  const result = await registerStaffWeighingItem({
    p_order_number: input.orderNumber,
    p_product_id: input.productId,
    p_weight_kg: input.weightKg,
    p_operation_key: input.operationId,
    p_employee_id: actor.id,
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
