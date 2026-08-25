import { cookies } from "next/headers";
import { getTableCustomerSessionController, openTableCustomerSessionController } from "@/src/modules/table-orders/table-orders.controller";
import { TABLE_CUSTOMER_COOKIE, tableCustomerCookieOptions } from "@/src/modules/table-orders/table-orders.cookies";
import { validatePublicTableToken, validateTableCustomer } from "@/src/modules/table-orders/table-orders.validation";
import { handleApiError, successResponse } from "@/src/shared/http/api-response";

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const rawToken = (await cookies()).get(TABLE_CUSTOMER_COOKIE)?.value;
    return getTableCustomerSessionController(validatePublicTableToken(token), rawToken);
  } catch (error) { return handleApiError(error); }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const result = await openTableCustomerSessionController(validatePublicTableToken(token), validateTableCustomer(await request.json()));
    const response = successResponse(result.session, 201);
    response.cookies.set(TABLE_CUSTOMER_COOKIE, result.rawToken, tableCustomerCookieOptions);
    return response;
  } catch (error) { return handleApiError(error); }
}
