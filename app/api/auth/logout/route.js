import { logoutController } from "@/src/modules/auth/auth.controller";
import { handleApiError } from "@/src/shared/http/api-response";

export async function POST() {
  try {
    return logoutController();
  } catch (error) {
    return handleApiError(error);
  }
}
