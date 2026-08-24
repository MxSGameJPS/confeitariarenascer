import { AppError } from "@/src/shared/errors/app-error";

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR" });
}

export function validateCreateSuperadmin(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados do administrador inválidos.");
  }

  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (fullName.length < 2 || fullName.length > 120) invalid("Informe o nome do administrador.");
  if (!email || !email.includes("@") || email.length > 254) invalid("E-mail inválido.");
  if (password.length < 8 || password.length > 128) invalid("A senha deve ter entre 8 e 128 caracteres.");

  return { fullName, email, password };
}

export function validateSuperadminId(value) {
  const id = String(value ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    invalid("Administrador inválido.");
  }
  return id;
}
