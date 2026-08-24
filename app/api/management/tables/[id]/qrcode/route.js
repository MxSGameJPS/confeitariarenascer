import { PERMISSIONS } from "@/src/config/permissions";
import { getTableQrService } from "@/src/modules/tables/tables.service";
import { validateTableId } from "@/src/modules/tables/tables.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
function surface(request) { const value = request.headers.get("x-renascer-surface"); return value === "admin" || value === "staff" ? value : null; }
export async function GET(request, { params }) {
  try {
    await requirePermissionSession(PERMISSIONS.TABLES_VIEW, surface(request));
    const { id } = await params;
    const table = await getTableQrService(validateTableId(id));
    const target = `${request.nextUrl.origin}/mesa/${table.public_token}`;
    const qrUrl = `https://quickchart.io/qr?size=900&margin=3&text=${encodeURIComponent(target)}`;
    const image = await fetch(qrUrl, { cache: "no-store" });
    if (!image.ok) throw new Error("Falha ao gerar QR Code");
    return new Response(await image.arrayBuffer(), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename=mesa-${table.table_number}-qrcode.png`, "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error); }
}
