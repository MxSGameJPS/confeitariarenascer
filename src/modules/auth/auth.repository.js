import { getSupabasePublicEnv } from "@/src/config/env";
import { supabaseServerRequest } from "@/src/config/supabase/server";
import { AppError } from "@/src/shared/errors/app-error";

async function parse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function signInWithPassword({ email, password }) {
  const { url, publishableKey } = getSupabasePublicEnv();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await parse(response);

  if (!response.ok) {
    throw new AppError("E-mail ou senha inválidos.", {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  return data;
}

export async function getUserByAccessToken(accessToken) {
  const { url, publishableKey } = getSupabasePublicEnv();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return parse(response);
}

export async function getProfileByUserId(userId) {
  const params = new URLSearchParams({
    select: "id,full_name,role,active",
    id: `eq.${userId}`,
    limit: "1",
  });

  const rows = await supabaseServerRequest(`/rest/v1/profiles?${params}`);
  return rows[0] ?? null;
}
