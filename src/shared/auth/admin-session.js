import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/src/modules/auth/auth.cookies";
import {
  getAdminSessionService,
  requireAdminService,
} from "@/src/modules/auth/auth.service";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  return getAdminSessionService(accessToken);
}

export async function requireAdminSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  return requireAdminService(accessToken);
}
