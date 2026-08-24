import { getSupabaseServerEnv } from "@/src/config/env";
import { supabaseServerRequest } from "@/src/config/supabase/server";

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function listSuperadminProfiles() {
  const params = new URLSearchParams({
    select: "id,full_name,email,role,active,created_at,updated_at",
    role: "eq.superadmin",
    order: "created_at.asc",
  });
  return supabaseServerRequest(`/rest/v1/profiles?${params}`);
}

export async function listPendingSuperadminRequests() {
  const params = new URLSearchParams({
    select: "id,email,full_name,created_at,consumed_at,canceled_at",
    consumed_at: "is.null",
    canceled_at: "is.null",
    order: "created_at.desc",
  });
  return supabaseServerRequest(`/rest/v1/superadmin_bootstrap_requests?${params}`);
}

export async function findProfileByEmail(email) {
  const params = new URLSearchParams({
    select: "id,full_name,email,role,active,created_at,updated_at",
    email: `eq.${email}`,
    limit: "1",
  });
  const rows = await supabaseServerRequest(`/rest/v1/profiles?${params}`);
  return rows[0] ?? null;
}

export async function createBootstrapRequest({ email, fullName, createdBy }) {
  const rows = await supabaseServerRequest("/rest/v1/superadmin_bootstrap_requests?select=*", {
    method: "POST",
    body: {
      email,
      full_name: fullName,
      created_by: createdBy,
    },
    prefer: "return=representation",
  });
  return rows[0];
}

export async function promoteProfileToSuperadmin(id, { fullName, email }) {
  const rows = await supabaseServerRequest(`/rest/v1/profiles?id=eq.${id}&select=*`, {
    method: "PATCH",
    body: {
      full_name: fullName,
      email,
      role: "superadmin",
      active: true,
    },
    prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function deactivateSuperadminProfile(id) {
  const rows = await supabaseServerRequest(`/rest/v1/profiles?id=eq.${id}&role=eq.superadmin&select=*`, {
    method: "PATCH",
    body: { active: false },
    prefer: "return=representation",
  });
  return rows[0] ?? null;
}

export async function createSupabaseAuthAdmin({ email, password, fullName }) {
  const { url, secretKey } = getSupabaseServerEnv();
  const headers = {
    apikey: secretKey,
    "Content-Type": "application/json",
  };

  if (secretKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${secretKey}`;
  }

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await parse(response),
  };
}

export async function writeSuperadminAudit({ actorId, action, entityId, metadata = {} }) {
  await supabaseServerRequest("/rest/v1/audit_logs", {
    method: "POST",
    body: {
      actor_id: actorId,
      actor_employee_id: null,
      actor_kind: "admin",
      action,
      entity_type: "superadmin",
      entity_id: entityId,
      metadata,
    },
  });
}
