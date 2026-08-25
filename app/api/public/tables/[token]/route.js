import { cookies } from "next/headers";
import { createTableOrderController, getTableMenuController } from "@/src/modules/table-orders/table-orders.controller";
import { TABLE_CUSTOMER_COOKIE } from "@/src/modules/table-orders/table-orders.cookies";
import { validatePublicTableToken, validateTableOrder } from "@/src/modules/table-orders/table-orders.validation";
import { handleApiError } from "@/src/shared/http/api-response";
export async function GET(_request, { params }) { try { const { token } = await params; return await getTableMenuController(validatePublicTableToken(token)); } catch (error) { return handleApiError(error); } }
export async function POST(request, { params }) { try { const { token } = await params; const rawToken = (await cookies()).get(TABLE_CUSTOMER_COOKIE)?.value; return await createTableOrderController(validatePublicTableToken(token), validateTableOrder(await request.json()), rawToken); } catch (error) { return handleApiError(error); } }
