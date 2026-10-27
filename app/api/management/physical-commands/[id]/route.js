import { PERMISSIONS } from "@/src/config/permissions";
import { supabaseServerRequest } from "@/src/config/supabase/server";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
import { AppError } from "@/src/shared/errors/app-error";

export async function PATCH(request, { params }) {
  try {
    await requirePermissionSession(PERMISSIONS.MENU_MANAGE, "admin");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("Comanda inválida.", { statusCode: 400 });
    const body = await request.json();
    if (typeof body.active !== "boolean") throw new AppError("Estado inválido.", { statusCode: 400 });
    const data = await supabaseServerRequest(`/rest/v1/physical_commands?id=eq.${encodeURIComponent(id)}&select=id,command_number,active`, {
      method: "PATCH", prefer: "return=representation", body: { active: body.active },
    });
    if (!data.length) throw new AppError("Comanda não encontrada.", { statusCode: 404 });
    return Response.json({ data: data[0] });
  } catch (error) { return handleApiError(error); }
}
