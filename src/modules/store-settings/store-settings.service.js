import { AppError } from "@/src/shared/errors/app-error";
import { findStoreSettings, updateStoreSettings, writeSettingsAudit } from "./store-settings.repository";

function map(settings) {
  if (!settings) return null;
  return {
    id: settings.id,
    storeName: settings.store_name,
    acceptsOrders: settings.accepts_orders,
    deliveryFee: Number(settings.delivery_fee),
    minimumOrder: Number(settings.minimum_order),
    deliveryEstimateMin: settings.delivery_estimate_min,
    deliveryEstimateMax: settings.delivery_estimate_max,
    pickupEstimateMin: settings.pickup_estimate_min,
    pickupEstimateMax: settings.pickup_estimate_max,
    whatsapp: settings.whatsapp,
    businessHours: settings.business_hours ?? [],
    deliveryAreas: settings.delivery_areas ?? [],
    timezone: settings.store_timezone,
    updatedAt: settings.updated_at,
  };
}

export async function getDeliverySettingsService() {
  const settings = await findStoreSettings();
  if (!settings) throw new AppError("Configuração da loja não encontrada.", { statusCode: 503, code: "STORE_NOT_CONFIGURED" });
  return map(settings);
}

export async function updateDeliverySettingsService(input, actor) {
  const settings = await updateStoreSettings({
    accepts_orders: input.acceptsOrders,
    delivery_fee: input.deliveryFee,
    minimum_order: input.minimumOrder,
    delivery_estimate_min: input.deliveryEstimateMin,
    delivery_estimate_max: input.deliveryEstimateMax,
    pickup_estimate_min: input.pickupEstimateMin,
    pickup_estimate_max: input.pickupEstimateMax,
    whatsapp: input.whatsapp,
    business_hours: input.businessHours,
    delivery_areas: input.deliveryAreas,
  });
  if (!settings) throw new AppError("Configuração da loja não encontrada.", { statusCode: 404, code: "STORE_NOT_CONFIGURED" });
  await writeSettingsAudit(actor.id, settings);
  return map(settings);
}

