import { PERMISSIONS } from "@/src/config/permissions";
import { supabaseServerRequest } from "@/src/config/supabase/server";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
import { AppError } from "@/src/shared/errors/app-error";

export async function GET(request) {
  try {
    const surface = request.headers.get("x-renascer-surface") === "admin" ? "admin" : "staff";
    await requirePermissionSession(surface === "admin" ? PERMISSIONS.COMMANDS_RECEIVE : PERMISSIONS.WEIGHING_ACCESS, surface);
    const data = await supabaseServerRequest("/rest/v1/physical_commands?select=id,command_number,active,created_at&order=command_number.asc&limit=10000");
    return Response.json({ data });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.MENU_MANAGE, "admin");
    const body = await request.json();
    const start = Number(body.start);
    const end = Number(body.end ?? body.start);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end - start > 499 || end > 999999999999) {
      throw new AppError("Informe números válidos (até 500 comandas por lote).", { statusCode: 400, code: "INVALID_COMMAND_RANGE" });
    }
    const entries = Array.from({ length: end - start + 1 }, (_, index) => ({ command_number: start + index, created_by: actor.id }));
    const data = await supabaseServerRequest("/rest/v1/physical_commands?on_conflict=command_number", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: entries,
    });
    return Response.json({ data, inserted: data.length }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
