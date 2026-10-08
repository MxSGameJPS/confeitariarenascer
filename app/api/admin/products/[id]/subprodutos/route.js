import { requireAdminSession } from "@/src/shared/auth/admin-session";
import { handleApiError } from "@/src/shared/http/api-response";
import { listVariants, createVariant, updateVariant } from "@/src/modules/custom-variants/custom-variants.service";

export async function GET(_request, { params }) {
  try {
    await requireAdminSession();
    return Response.json({ data: await listVariants((await params).id) });
  } catch (error) { return handleApiError(error); }
}
export async function POST(request, { params }) {
  try {
    const actor = await requireAdminSession();
    return Response.json({ data: await createVariant((await params).id, await request.json(), actor) }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
export async function PATCH(request, { params }) {
  try {
    const actor = await requireAdminSession();
    const { variantId, ...payload } = await request.json();
    return Response.json({ data: await updateVariant((await params).id, variantId, payload, actor) });
  } catch (error) { return handleApiError(error); }
}
