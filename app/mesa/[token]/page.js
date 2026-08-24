import TableOrderClient from "@/app/mesa/[token]/TableOrderClient";
import { validatePublicTableToken } from "@/src/modules/table-orders/table-orders.validation";
export default async function TablePage({ params }) { const { token } = await params; return <TableOrderClient token={validatePublicTableToken(token)} />; }
