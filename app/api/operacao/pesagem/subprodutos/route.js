import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";
import { listActiveVariants } from "@/src/modules/custom-variants/custom-variants.service";
export async function GET(request) {
  try {
    await requirePermissionSession(PERMISSIONS.WEIGHING_ACCESS, "staff");
    return Response.json({ data: await listActiveVariants(new URL(request.url).searchParams.get("productId")) });
  } catch (error) { return handleApiError(error); }
}
