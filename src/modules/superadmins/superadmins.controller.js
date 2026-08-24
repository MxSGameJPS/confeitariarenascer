import { successResponse } from "@/src/shared/http/api-response";
import {
  createSuperadminService,
  deactivateSuperadminService,
  listSuperadminsService,
} from "@/src/modules/superadmins/superadmins.service";

export async function listSuperadminsController(actor) {
  return successResponse(await listSuperadminsService(actor));
}

export async function createSuperadminController(input, actor) {
  return successResponse(await createSuperadminService(input, actor), 201);
}

export async function deactivateSuperadminController(id, actor) {
  return successResponse(await deactivateSuperadminService(id, actor));
}
