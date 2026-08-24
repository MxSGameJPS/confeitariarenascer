import { NextResponse } from "next/server";
import { clearStaffSessionCookie, setStaffSessionCookie } from "@/src/modules/staff-auth/staff-auth.cookies";
import {
  getStaffSessionService,
  loginStaffService,
  logoutStaffService,
} from "@/src/modules/staff-auth/staff-auth.service";

export async function loginStaffController(credentials) {
  const session = await loginStaffService(credentials);
  const response = NextResponse.json({ data: { user: session.user } }, { status: 200 });
  setStaffSessionCookie(response, session);
  return response;
}

export async function logoutStaffController(rawToken) {
  await logoutStaffService(rawToken);
  const response = NextResponse.json({ data: { success: true } }, { status: 200 });
  clearStaffSessionCookie(response);
  return response;
}

export async function staffSessionController(rawToken) {
  const user = await getStaffSessionService(rawToken, { touch: true });
  return NextResponse.json({ data: { user } }, { status: 200 });
}
