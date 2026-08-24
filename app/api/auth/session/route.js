import { cookies } from "next/headers";
import { sessionController } from "@/src/modules/auth/auth.controller";
import { ACCESS_COOKIE } from "@/src/modules/auth/auth.cookies";
import { handleApiError } from "@/src/shared/http/api-response";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    return await sessionController(accessToken);
  } catch (error) {
    return handleApiError(error);
  }
}
