import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/src/shared/errors/app-error";
import { verifyPassword } from "@/src/shared/auth/password";
import {
  createStaffSession,
  findStaffByUsername,
  findStaffSessionByTokenHash,
  markStaffLogin,
  revokeStaffSession,
  touchStaffSession,
  writeStaffAuthAudit,
} from "@/src/modules/staff-auth/staff-auth.repository";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function toPrincipal(employee) {
  return {
    kind: "employee",
    id: employee.id,
    fullName: employee.full_name,
    username: employee.username,
    role: employee.role,
    mustChangePassword: employee.must_change_password,
  };
}

export async function loginStaffService(credentials) {
  const employee = await findStaffByUsername(credentials.username);
  const passwordMatches = employee
    ? await verifyPassword(credentials.password, employee.password_hash)
    : false;

  if (!employee || !passwordMatches || !employee.active) {
    throw new AppError("Usuário ou senha inválidos.", {
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await createStaffSession({
    employeeId: employee.id,
    tokenHash,
    expiresAt,
  });
  await markStaffLogin(employee.id);
  await writeStaffAuthAudit({
    employeeId: employee.id,
    action: "staff.login",
    metadata: { role: employee.role },
  });

  return {
    token: rawToken,
    expiresAt,
    user: toPrincipal(employee),
  };
}

export async function getStaffSessionService(rawToken, { touch = false } = {}) {
  if (!rawToken) return null;

  const session = await findStaffSessionByTokenHash(hashToken(rawToken));
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const employee = session.employee;
  if (!employee || !employee.active) return null;

  if (touch) {
    const lastSeen = new Date(session.last_seen_at).getTime();
    if (!Number.isNaN(lastSeen) && Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
      await touchStaffSession(session.id);
    }
  }

  return toPrincipal(employee);
}

export async function requireStaffSessionService(rawToken) {
  const principal = await getStaffSessionService(rawToken, { touch: true });
  if (!principal) {
    throw new AppError("Sessão de funcionário inválida ou expirada.", {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }
  return principal;
}

export async function logoutStaffService(rawToken) {
  if (!rawToken) return;
  await revokeStaffSession(hashToken(rawToken));
}
