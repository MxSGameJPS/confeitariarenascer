import { loginController } from "@/src/modules/auth/auth.controller";
import { validateLogin } from "@/src/modules/auth/auth.validation";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST(request) {
  try {
    const payload = await request.json();
    const input = validateLogin(payload);
    return await loginController(input);
  } catch (error) {
    return handleApiError(error);
  }
}
