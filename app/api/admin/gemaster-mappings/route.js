import { PERMISSIONS } from "@/src/config/permissions";
import { listGemasterMappingsController, upsertGemasterMappingController } from "@/src/modules/bridge/bridge.controller";
import { validateGemasterMapping } from "@/src/modules/bridge/bridge.validation";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    await requirePermissionSession(PERMISSIONS.BRIDGE_MANAGE, "admin");
    return await listGemasterMappingsController();
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await requirePermissionSession(PERMISSIONS.BRIDGE_MANAGE, "admin");
    return await upsertGemasterMappingController(validateGemasterMapping(await request.json()), actor);
  } catch (error) {
    return handleApiError(error);
  }
}
