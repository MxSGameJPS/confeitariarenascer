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

export async function supabaseServerRequest(
  path,
  { method = "GET", body, headers = {}, prefer, cache = "no-store" } = {}
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
    throw new AppError("Falha ao acessar o banco de dados.", {
      statusCode: 500,
      code: "DATABASE_ERROR",
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
