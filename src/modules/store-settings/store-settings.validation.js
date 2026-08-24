import { AppError } from "@/src/shared/errors/app-error";

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" });
}

function money(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999999.99) invalid(`${label} inválido.`);
  return Number(parsed.toFixed(2));
}

function minutes(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) invalid(`${label} inválido.`);
  return parsed;
}

function time(value, label) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid(`${label} inválido.`);
  return value;
}

export function validateDeliverySettings(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid("Configurações inválidas.");
  if (typeof payload.acceptsOrders !== "boolean") invalid("Situação do delivery inválida.");

  const deliveryMin = minutes(payload.deliveryEstimateMin, "Estimativa mínima de entrega");
  const deliveryMax = minutes(payload.deliveryEstimateMax, "Estimativa máxima de entrega");
  const pickupMin = minutes(payload.pickupEstimateMin, "Estimativa mínima de retirada");
  const pickupMax = minutes(payload.pickupEstimateMax, "Estimativa máxima de retirada");
  if (deliveryMax < deliveryMin || pickupMax < pickupMin) invalid("A estimativa máxima deve ser maior ou igual à mínima.");

  if (!Array.isArray(payload.deliveryRegions) || payload.deliveryRegions.length > 100) invalid("Regiões atendidas inválidas.");
  const deliveryRegions = [...new Set(payload.deliveryRegions.map((region) => {
    if (typeof region !== "string") invalid("Região atendida inválida.");
    const normalized = region.trim();
    if (normalized.length < 2 || normalized.length > 80) invalid("Cada região deve ter entre 2 e 80 caracteres.");
    return normalized;
  }))];

  if (!Array.isArray(payload.businessHours) || (payload.businessHours.length !== 0 && payload.businessHours.length !== 7)) {
    invalid("Informe os sete dias da semana ou deixe os horários sem configuração.");
  }
  const seen = new Set();
  const businessHours = payload.businessHours.map((entry) => {
    const day = Number(entry?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day) || typeof entry.enabled !== "boolean") invalid("Horário semanal inválido.");
    seen.add(day);
    return { day, enabled: entry.enabled, opens: time(entry.opens, "Abertura"), closes: time(entry.closes, "Fechamento") };
  }).sort((a, b) => a.day - b.day);

  return {
    acceptsOrders: payload.acceptsOrders,
    deliveryFee: money(payload.deliveryFee, "Taxa de entrega"),
    minimumOrder: money(payload.minimumOrder, "Pedido mínimo"),
    deliveryEstimateMin: deliveryMin,
    deliveryEstimateMax: deliveryMax,
    pickupEstimateMin: pickupMin,
    pickupEstimateMax: pickupMax,
    whatsapp: typeof payload.whatsapp === "string" ? payload.whatsapp.trim().slice(0, 30) || null : null,
    deliveryRegions,
    businessHours,
  };
}

