import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/src/modules/auth/auth.cookies";
import { getAdminSessionService } from "@/src/modules/auth/auth.service";
import { STAFF_SESSION_COOKIE } from "@/src/modules/staff-auth/staff-auth.cookies";
import { getStaffSessionService } from "@/src/modules/staff-auth/staff-auth.service";
import { AppError } from "@/src/shared/errors/app-error";
import { hasPermission } from "@/src/config/permissions";

async function getAdmin(cookieStore) {
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const admin = await getAdminSessionService(token);
  return admin ? { ...admin, kind: "admin" } : null;
}

async function getStaff(cookieStore) {
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;
  return getStaffSessionService(token, { touch: true });
}

export async function getPrincipalSession(preferredKind = null) {
  const cookieStore = await cookies();

  if (preferredKind === "admin") return getAdmin(cookieStore);
  if (preferredKind === "staff") return getStaff(cookieStore);

  return (await getAdmin(cookieStore)) ?? (await getStaff(cookieStore));
}

export async function requirePermissionSession(permission, preferredKind = null) {
  const principal = await getPrincipalSession(preferredKind);

  if (!principal) {
    throw new AppError("Sessão inválida ou expirada.", {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }

  if (!hasPermission(principal.role, permission)) {
    throw new AppError("Você não possui permissão para esta operação.", {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }

  return principal;
}
