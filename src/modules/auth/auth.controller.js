import { NextResponse } from "next/server";
import { clearAuthCookies, setAuthCookies } from "@/src/modules/auth/auth.cookies";
import { getAdminSessionService, loginService } from "@/src/modules/auth/auth.service";

export async function loginController(credentials) {
  const session = await loginService(credentials);
  const response = NextResponse.json({ data: { user: session.user } }, { status: 200 });
  setAuthCookies(response, session);
  return response;
}

export function logoutController() {
  const response = NextResponse.json({ data: { success: true } }, { status: 200 });
  clearAuthCookies(response);
  return response;
}

export async function sessionController(accessToken) {
  const session = await getAdminSessionService(accessToken);
  return NextResponse.json({ data: { user: session } }, { status: 200 });
}
