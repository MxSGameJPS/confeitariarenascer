import { supabaseServerRequest } from "@/src/config/supabase/server";
export async function findPublicTable(token) {
  const params = new URLSearchParams({ select: "id,table_number,seats,active,command_enabled", public_token: `eq.${token}`, limit: "1" });
  return (await supabaseServerRequest(`/rest/v1/dining_tables?${params}`))[0] ?? null;
}
export async function findPublicOrderProducts(ids) {
  const params = new URLSearchParams({ select: "id,name,description,price,unit,image_path,pricing_mode,active,available_internal", id: `in.(${ids.join(",")})`, active: "eq.true", available_internal: "eq.true" });
  return supabaseServerRequest(`/rest/v1/products?${params}`);
}
export async function createTableRequest(payload) {
  return supabaseServerRequest("/rest/v1/rpc/create_table_command_request", { method: "POST", body: payload });
}

