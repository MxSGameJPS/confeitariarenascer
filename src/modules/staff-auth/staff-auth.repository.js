import { supabaseServerRequest } from "@/src/config/supabase/server";

export async function findStaffByUsername(username) {
  const params = new URLSearchParams({
    select: "id,full_name,username,password_hash,role,active,must_change_password,last_login_at",
    username: `eq.${username}`,
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/employees?${params}`);
  return rows[0] ?? null;
}

export async function createStaffSession({ employeeId, tokenHash, expiresAt }) {
  const rows = await supabaseServerRequest("/rest/v1/employee_sessions?select=id,employee_id,expires_at", {
    method: "POST",
    body: {
      employee_id: employeeId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
    prefer: "return=representation",
  });

  return rows[0];
}

export async function findStaffSessionByTokenHash(tokenHash) {
  const params = new URLSearchParams({
    select: "id,employee_id,expires_at,revoked_at,last_seen_at,employee:employees(id,full_name,username,role,active,must_change_password)",
    token_hash: `eq.${tokenHash}`,
    revoked_at: "is.null",
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/employee_sessions?${params}`);
  return rows[0] ?? null;
}

export async function touchStaffSession(sessionId) {
  await supabaseServerRequest(`/rest/v1/employee_sessions?id=eq.${sessionId}`, {
    method: "PATCH",
    body: { last_seen_at: new Date().toISOString() },
  });
}

export async function revokeStaffSession(tokenHash) {
  await supabaseServerRequest(`/rest/v1/employee_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null`, {
    method: "PATCH",
    body: { revoked_at: new Date().toISOString() },
  });
}

export async function markStaffLogin(employeeId) {
  await supabaseServerRequest(`/rest/v1/employees?id=eq.${employeeId}`, {
    method: "PATCH",
    body: { last_login_at: new Date().toISOString() },
  });
}

export async function writeStaffAuthAudit({ employeeId, action, metadata = {} }) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: {
      actor_id: null,
      actor_employee_id: employeeId,
      actor_kind: "employee",
      action,
      entity_type: "session",
      entity_id: employeeId,
      metadata,
    },
  });
}
