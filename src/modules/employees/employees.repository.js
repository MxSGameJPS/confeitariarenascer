import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function listEmployees() {
  const params = new URLSearchParams({
    select: "id,full_name,username,role,active,must_change_password,last_login_at,created_at,updated_at",
    order: "full_name.asc",
  });

  return supabaseServerRequest(`/rest/v1/employees?${params}`);
}

export async function findEmployeeById(id) {
  const params = new URLSearchParams({
    select: "id,full_name,username,password_hash,role,active,must_change_password,last_login_at,created_at,updated_at",
    id: `eq.${id}`,
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/employees?${params}`);
  return rows[0] ?? null;
}

export async function findEmployeeByUsername(username) {
  const params = new URLSearchParams({
    select: "id,full_name,username,password_hash,role,active,must_change_password,last_login_at,created_at,updated_at",
    username: `eq.${username}`,
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/employees?${params}`);
  return rows[0] ?? null;
}

export async function createEmployee(data) {
  const rows = await supabaseServerRequest("/rest/v1/employees?select=*", {
    method: "POST",
    body: data,
    prefer: "return=representation",
  });

  return rows[0];
}

export async function updateEmployee(id, data) {
  const rows = await supabaseServerRequest(`/rest/v1/employees?id=eq.${id}&select=*`, {
    method: "PATCH",
    body: data,
    prefer: "return=representation",
  });

  return rows[0] ?? null;
}

export async function revokeEmployeeSessions(employeeId) {
  await supabaseServerRequest(`/rest/v1/employee_sessions?employee_id=eq.${employeeId}&revoked_at=is.null`, {
    method: "PATCH",
    body: { revoked_at: new Date().toISOString() },
  });
}

export async function writeEmployeeAuditLog({ actor, action, entityId, metadata = {} }) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: {
      actor_id: actor.kind === "admin" ? actor.id : null,
      actor_employee_id: actor.kind === "employee" ? actor.id : null,
      actor_kind: actor.kind,
      action,
      entity_type: "employee",
      entity_id: entityId,
      metadata,
    },
  });
}
