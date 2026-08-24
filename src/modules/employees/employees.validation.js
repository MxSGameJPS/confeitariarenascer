import { AppError } from "@/src/shared/errors/app-error";
import { ROLES } from "@/src/config/permissions";

const EMPLOYEE_ROLES = new Set([ROLES.GERENTE, ROLES.ATENDENTE]);

function invalid(message, details = null) {
  throw new AppError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    details,
  });
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    invalid("O usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.");
  }
  return username;
}

function validatePassword(value, { required = true } = {}) {
  if (!required && (value === undefined || value === null || value === "")) return null;
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128) {
    invalid("A senha deve ter entre 8 e 128 caracteres.");
  }
  return password;
}

function validateRole(value) {
  if (!EMPLOYEE_ROLES.has(value)) {
    invalid("Cargo inválido. Use gerente ou atendente.");
  }
  return value;
}

export function validateEmployeeId(value) {
  const id = String(value ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    invalid("Funcionário inválido.");
  }
  return id;
}

export function validateCreateEmployee(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados do funcionário inválidos.");
  }

  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 120) {
    invalid("Informe o nome completo do funcionário.");
  }

  return {
    fullName,
    username: validateUsername(payload.username),
    password: validatePassword(payload.password),
    role: validateRole(payload.role),
    active: payload.active !== false,
    mustChangePassword: payload.mustChangePassword === true,
  };
}

export function validateUpdateEmployee(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados do funcionário inválidos.");
  }

  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 120) {
    invalid("Informe o nome completo do funcionário.");
  }

  return {
    fullName,
    username: validateUsername(payload.username),
    role: validateRole(payload.role),
    active: payload.active !== false,
  };
}

export function validateResetEmployeePassword(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    invalid("Dados de senha inválidos.");
  }

  return {
    password: validatePassword(payload.password),
    mustChangePassword: payload.mustChangePassword === true,
  };
}
