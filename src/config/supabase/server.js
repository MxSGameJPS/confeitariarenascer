import { getSupabaseServerEnv } from "@/src/config/env";
import { AppError } from "@/src/shared/errors/app-error";

async function parseResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function safeDatabaseMessage(data, prefixes) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) return null;
  const message = typeof data?.message === "string" ? data.message.trim() : "";
  if (!message) return null;
  return prefixes.some((prefix) => message.startsWith(prefix)) ? message : null;
}

export async function supabaseServerRequest(
  path,
  { method = "GET", body, headers = {}, prefer, cache = "no-store", safeErrorPrefixes = [] } = {}
) {
  const { url, secretKey } = getSupabaseServerEnv();
  const target = new URL(path, `${url}/`);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(target, {
    method,
    cache,
    headers: {
      apikey: secretKey,
      ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body:
      body === undefined || body === null || isFormData
        ? body
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const safeMessage = safeDatabaseMessage(data, safeErrorPrefixes);
    throw new AppError(safeMessage || "Falha ao acessar o banco de dados.", {
      statusCode: safeMessage ? 409 : 500,
      code: safeMessage ? "DATABASE_BUSINESS_RULE" : "DATABASE_ERROR",
      details:
        process.env.NODE_ENV === "development"
          ? { status: response.status, response: data }
          : null,
    });
  }

  return data;
}

export function getPublicStorageUrl(objectPath) {
  if (!objectPath) return null;

  if (/^https?:\/\//i.test(objectPath)) return objectPath;

  const { url, storageBucket } = getSupabaseServerEnv();
  const encodedPath = objectPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `${url}/storage/v1/object/public/${encodeURIComponent(storageBucket)}/${encodedPath}`;
}
