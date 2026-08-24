import { AppError } from "@/src/shared/errors/app-error";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new AppError(`Variável de ambiente ausente: ${name}`, {
      statusCode: 500,
      code: "ENV_MISSING",
    });
  }

  return value;
}

export function getSupabaseServerEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    secretKey: required("SUPABASE_SECRET_KEY"),
    storageBucket:
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "produtos",
  };
}

export function getSupabasePublicEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
