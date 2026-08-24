import SalesWorkspace from "@/app/operacao/components/SalesWorkspace";
import { PERMISSIONS, hasPermission } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export default async function PosPage() {
  const session = await requirePermissionSession(PERMISSIONS.POS_ACCESS, "staff");
  return <SalesWorkspace channel="pos" canCancel={hasPermission(session.role, PERMISSIONS.SALES_CANCEL)} />;
}
