import {
  getProfileByUserId,
  getUserByAccessToken,
  signInWithPassword,
} from "@/src/modules/auth/auth.repository";
import { AppError } from "@/src/shared/errors/app-error";

export async function loginService(credentials) {
  const auth = await signInWithPassword(credentials);
  const profile = await getProfileByUserId(auth.user.id);

  if (!profile || !profile.active || profile.role !== "admin") {
    throw new AppError("Este usuário não possui acesso administrativo.", {
      statusCode: 403,
      code: "ADMIN_ACCESS_REQUIRED",
    });
  }

  return {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    expiresIn: auth.expires_in,
    user: {
      id: auth.user.id,
      email: auth.user.email,
      fullName: profile.full_name,
      role: profile.role,
    },
  };
}

export async function getAdminSessionService(accessToken) {
  if (!accessToken) return null;

  const user = await getUserByAccessToken(accessToken);
  if (!user) return null;

  const profile = await getProfileByUserId(user.id);
  if (!profile || !profile.active || profile.role !== "admin") return null;

  return {
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role,
  };
}

export async function requireAdminService(accessToken) {
  const session = await getAdminSessionService(accessToken);

  if (!session) {
    throw new AppError("Sessão administrativa inválida ou expirada.", {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }

  return session;
}
