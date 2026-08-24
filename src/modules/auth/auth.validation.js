import { AppError } from "@/src/shared/errors/app-error";

function invalid(message) {
  throw new AppError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
  });
}

export function validateLogin(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados de acesso inválidos.");
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!email || !email.includes("@") || email.length > 254) {
    invalid("E-mail inválido.");
  }

  if (!password || password.length > 200) {
    invalid("Senha inválida.");
  }

  return { email, password };
}
