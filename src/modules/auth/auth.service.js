import {
  getProfileByUserId,
  getUserByAccessToken,
  signInWithPassword,
} from "@/src/modules/auth/auth.repository";
import { AppError } from "@/src/shared/errors/app-error";
import { ROLES, normalizeRole } from "@/src/config/permissions";

function isSuperadminProfile(profile) {
  return Boolean(
    profile
    && profile.active
    && normalizeRole(profile.role) === ROLES.SUPERADMIN
  );
}

export async function loginService(credentials) {
  const auth = await signInWithPassword(credentials);
  const profile = await getProfileByUserId(auth.user.id);

  if (!isSuperadminProfile(profile)) {
    throw new AppError("Este usuário não possui acesso de Superadmin.", {
      statusCode: 403,
      code: "SUPERADMIN_ACCESS_REQUIRED",
    });
  }

  return {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    expiresIn: auth.expires_in,
    user: {
      kind: "admin",
      id: auth.user.id,
      email: auth.user.email,
      fullName: profile.full_name,
      role: ROLES.SUPERADMIN,
    },
  };
}

export async function getAdminSessionService(accessToken) {
  if (!accessToken) return null;

  const user = await getUserByAccessToken(accessToken);
  if (!user) return null;

  const profile = await getProfileByUserId(user.id);
  if (!isSuperadminProfile(profile)) return null;

  return {
    kind: "admin",
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: ROLES.SUPERADMIN,
  };
}

export async function requireAdminService(accessToken) {
  const session = await getAdminSessionService(accessToken);

  if (!session) {
    throw new AppError("Sessão de Superadmin inválida ou expirada.", {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }

  return session;
}
