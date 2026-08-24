import { AppError } from "@/src/shared/errors/app-error";
import { hashPassword } from "@/src/shared/auth/password";
import { PERMISSIONS, hasPermission } from "@/src/config/permissions";
import {
  createEmployee,
  findEmployeeById,
  findEmployeeByUsername,
  listEmployees,
  revokeEmployeeSessions,
  updateEmployee,
  writeEmployeeAuditLog,
} from "@/src/modules/employees/employees.repository";

function requirePermission(actor, permission) {
  if (!actor || !hasPermission(actor.role, permission)) {
    throw new AppError("Você não possui permissão para esta operação.", {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }
}

function publicEmployee(employee) {
  if (!employee) return null;
  const { password_hash, ...safe } = employee;
  return safe;
}

export async function listEmployeesService(actor) {
  requirePermission(actor, PERMISSIONS.EMPLOYEES_VIEW);
  return listEmployees();
}

export async function createEmployeeService(input, actor) {
  requirePermission(actor, PERMISSIONS.EMPLOYEES_CREATE);

  const existing = await findEmployeeByUsername(input.username);
  if (existing) {
    throw new AppError("Este nome de usuário já está em uso.", {
      statusCode: 409,
      code: "USERNAME_IN_USE",
    });
  }

  const passwordHash = await hashPassword(input.password);
  const employee = await createEmployee({
    full_name: input.fullName,
    username: input.username,
    password_hash: passwordHash,
    role: input.role,
    active: input.active,
    must_change_password: input.mustChangePassword,
    created_by: actor.kind === "admin" ? actor.id : null,
  });

  await writeEmployeeAuditLog({
    actor,
    action: "employee.created",
    entityId: employee.id,
    metadata: {
      full_name: employee.full_name,
      username: employee.username,
      role: employee.role,
    },
  });

  return publicEmployee(employee);
}

export async function updateEmployeeService(id, input, actor) {
  requirePermission(actor, PERMISSIONS.EMPLOYEES_UPDATE);

  const current = await findEmployeeById(id);
  if (!current) {
    throw new AppError("Funcionário não encontrado.", {
      statusCode: 404,
      code: "EMPLOYEE_NOT_FOUND",
    });
  }

  const sameUsername = await findEmployeeByUsername(input.username);
  if (sameUsername && sameUsername.id !== id) {
    throw new AppError("Este nome de usuário já está em uso.", {
      statusCode: 409,
      code: "USERNAME_IN_USE",
    });
  }

  const employee = await updateEmployee(id, {
    full_name: input.fullName,
    username: input.username,
    role: input.role,
    active: input.active,
  });

  if (!input.active && current.active) {
    await revokeEmployeeSessions(id);
  }

  await writeEmployeeAuditLog({
    actor,
    action: "employee.updated",
    entityId: id,
    metadata: {
      before: {
        full_name: current.full_name,
        username: current.username,
        role: current.role,
        active: current.active,
      },
      after: {
        full_name: employee.full_name,
        username: employee.username,
        role: employee.role,
        active: employee.active,
      },
    },
  });

  return publicEmployee(employee);
}

export async function resetEmployeePasswordService(id, input, actor) {
  requirePermission(actor, PERMISSIONS.EMPLOYEES_RESET_PASSWORD);

  const current = await findEmployeeById(id);
  if (!current) {
    throw new AppError("Funcionário não encontrado.", {
      statusCode: 404,
      code: "EMPLOYEE_NOT_FOUND",
    });
  }

  const passwordHash = await hashPassword(input.password);
  const employee = await updateEmployee(id, {
    password_hash: passwordHash,
    must_change_password: input.mustChangePassword,
  });

  await revokeEmployeeSessions(id);

  await writeEmployeeAuditLog({
    actor,
    action: "employee.password_reset",
    entityId: id,
    metadata: { username: current.username },
  });

  return publicEmployee(employee);
}
