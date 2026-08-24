import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "@/src/modules/staff-auth/staff-auth.cookies";
import {
  getStaffSessionService,
  requireStaffSessionService,
} from "@/src/modules/staff-auth/staff-auth.service";

export async function getStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  return getStaffSessionService(token, { touch: true });
}

export async function requireStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  return requireStaffSessionService(token);
}
