import { AppError } from "@/src/shared/errors/app-error";
import { createTable, findTableById, findTableByNumber, listActiveTableVisits, listTables, updateTable, writeTableAudit } from "@/src/modules/tables/tables.repository";

export async function listTablesService() {
  const [tables, visits] = await Promise.all([listTables(), listActiveTableVisits()]);
  const byTable = new Map(visits.map((visit) => [visit.table_id, visit]));

  return tables.map((table) => {
    const visit = byTable.get(table.id);
    return {
      ...table,
      occupancy_status: visit?.status ?? "livre",
      active_visit_id: visit?.id ?? null,
      occupied_at: visit?.occupied_at ?? null,
      visit_opened_at: visit?.opened_at ?? null,
    };
  });
}

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
