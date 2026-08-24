import { supabaseServerRequest } from "@/src/config/supabase/server";

const SELECT = "id,store_name,accepts_orders,delivery_fee,minimum_order,delivery_estimate_min,delivery_estimate_max,pickup_estimate_min,pickup_estimate_max,whatsapp,business_hours,delivery_areas,store_timezone,updated_at";

export async function findStoreSettings() {
  const rows = await supabaseServerRequest(`/rest/v1/store_settings?select=${SELECT}&id=eq.1&limit=1`);
  return rows[0] ?? null;
}

export async function updateStoreSettings(data) {
  const rows = await supabaseServerRequest(`/rest/v1/store_settings?id=eq.1&select=${SELECT}`, {
    method: "PATCH",
    body: data,
    prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function writeSettingsAudit(actorId, settings) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: {
      actor_id: actorId,
      action: "delivery.settings_updated",
      entity_type: "store_settings",
      entity_id: "1",
      metadata: {
        accepts_orders: settings.accepts_orders,
        delivery_fee: settings.delivery_fee,
        minimum_order: settings.minimum_order,
        delivery_areas: settings.delivery_areas,
      },
    },
  });
}

