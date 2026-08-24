import { loginStaffController } from "@/src/modules/staff-auth/staff-auth.controller";
import { validateStaffLogin } from "@/src/modules/staff-auth/staff-auth.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const input = validateStaffLogin(await request.json());
    return await loginStaffController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
