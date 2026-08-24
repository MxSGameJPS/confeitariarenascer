import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/src/modules/auth/auth.cookies";
import { getAdminSessionService } from "@/src/modules/auth/auth.service";
import { STAFF_SESSION_COOKIE } from "@/src/modules/staff-auth/staff-auth.cookies";
import { getStaffSessionService } from "@/src/modules/staff-auth/staff-auth.service";
import { AppError } from "@/src/shared/errors/app-error";
import { hasPermission } from "@/src/config/permissions";

export async function getPrincipalSession() {
  const cookieStore = await cookies();

  const adminToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (adminToken) {
    const admin = await getAdminSessionService(adminToken);
    if (admin) return { ...admin, kind: "admin" };
  }

  const staffToken = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (staffToken) {
    const staff = await getStaffSessionService(staffToken, { touch: true });
    if (staff) return staff;
  }

  return null;
}

export async function requirePermissionSession(permission) {
  const principal = await getPrincipalSession();

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
