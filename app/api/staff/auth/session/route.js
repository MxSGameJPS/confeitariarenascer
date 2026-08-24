import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "@/src/modules/staff-auth/staff-auth.cookies";
import { staffSessionController } from "@/src/modules/staff-auth/staff-auth.controller";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
    return await staffSessionController(token);
  } catch (error) {
    return handleApiError(error);
  }
}
