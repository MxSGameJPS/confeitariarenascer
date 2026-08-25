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

  if (!Array.isArray(payload.deliveryAreas) || payload.deliveryAreas.length > 200) invalid("Áreas atendidas inválidas.");
  const keys = new Set();
  const deliveryAreas = payload.deliveryAreas.map((area) => {
    if (!area || typeof area !== "object" || Array.isArray(area)) invalid("Área atendida inválida.");
    const city = typeof area.city === "string" ? area.city.trim() : "";
    const entireCity = area.entireCity === true;
    const point = entireCity ? null : typeof area.point === "string" ? area.point.trim() : "";
    const deliveryFee = money(area.deliveryFee ?? payload.deliveryFee, "Taxa da área de entrega");
    if (city.length < 2 || city.length > 80) invalid("Informe uma cidade válida.");
    if (!entireCity && (point.length < 2 || point.length > 100)) invalid("Informe o bairro ou ponto atendido.");
    const key = `${city.toLowerCase()}|${entireCity ? "*" : point.toLowerCase()}`;
    if (keys.has(key)) invalid("Esta área de entrega já foi cadastrada.");
    keys.add(key);
    return { city, point, entireCity, deliveryFee };
  });

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
    deliveryAreas,
    businessHours,
  };
}

