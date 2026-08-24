import TableManager from "@/app/components/TableManager/TableManager";
import { requireAdminSession } from "@/src/shared/auth/admin-session";
export default async function AdminTablesPage() { await requireAdminSession(); return <TableManager surface="admin" canCreate />; }
