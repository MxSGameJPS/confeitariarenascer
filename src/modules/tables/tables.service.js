import { AppError } from "@/src/shared/errors/app-error";
import { createTable, findTableById, findTableByNumber, listTables, updateTable, writeTableAudit } from "@/src/modules/tables/tables.repository";

export async function listTablesService() { return listTables(); }
export async function createTableService(input, actor) {
  if (await findTableByNumber(input.tableNumber)) throw new AppError("Já existe uma mesa com este número.", { statusCode: 409, code: "TABLE_NUMBER_EXISTS" });
  const table = await createTable({ table_number: input.tableNumber, seats: input.seats, active: true, command_enabled: true, created_by: actor.id });
  await writeTableAudit({ actor, action: "table.created", entityId: table.id, metadata: { table_number: table.table_number, seats: table.seats } });
  return table;
}
export async function updateTableStatusService(id, input, actor) {
  const table = await updateTable(id, { active: input.active, command_enabled: input.commandEnabled });
  if (!table) throw new AppError("Mesa não encontrada.", { statusCode: 404, code: "TABLE_NOT_FOUND" });
  await writeTableAudit({ actor, action: "table.status_updated", entityId: id, metadata: { table_number: table.table_number, active: table.active, command_enabled: table.command_enabled } });
  return table;
}
export async function getTableQrService(id) {
  const table = await findTableById(id);
  if (!table) throw new AppError("Mesa não encontrada.", { statusCode: 404, code: "TABLE_NOT_FOUND" });
  return table;
}
