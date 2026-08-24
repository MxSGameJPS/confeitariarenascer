import TableManager from "@/app/components/TableManager/TableManager";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";
export default async function StaffTablesPage() { await requirePermissionSession(PERMISSIONS.TABLES_STATUS, "staff"); return <TableManager surface="staff" canCreate={false} />; }
