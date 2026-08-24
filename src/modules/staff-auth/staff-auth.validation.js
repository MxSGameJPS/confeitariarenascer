import { AppError } from "@/src/shared/errors/app-error";

function invalid(message) {
  throw new AppError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
  });
}

export function validateStaffLogin(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados de acesso inválidos.");
  }

  const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    invalid("Usuário inválido.");
  }

  if (!password || password.length > 128) {
    invalid("Senha inválida.");
  }

  return { username, password };
}
