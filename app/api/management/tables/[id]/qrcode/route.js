import { PERMISSIONS } from "@/src/config/permissions";
import { getTableQrService } from "@/src/modules/tables/tables.service";
import { validateTableId } from "@/src/modules/tables/tables.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
import { qrSvgString } from "@/src/modules/tables/qr-code";
function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }
export async function GET(request, { params }) {
  try {
    await requirePermissionSession(PERMISSIONS.TABLES_VIEW, surface(request));
    const { id } = await params;
    const table = await getTableQrService(validateTableId(id));
    const target = `${request.nextUrl.origin}/mesa/${table.public_token}`;
    const svg = qrSvgString(target);
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename=mesa-${table.table_number}-qrcode.svg`, "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error); }
}
