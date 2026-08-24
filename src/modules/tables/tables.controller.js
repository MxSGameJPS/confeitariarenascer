import { successResponse } from "@/src/shared/http/api-response";
import { createTableService, listTablesService, updateTableStatusService } from "@/src/modules/tables/tables.service";
export async function listTablesController() { return successResponse(await listTablesService()); }
export async function createTableController(input, actor) { return successResponse(await createTableService(input, actor), 201); }
export async function updateTableStatusController(id, input, actor) { return successResponse(await updateTableStatusService(id, input, actor)); }
