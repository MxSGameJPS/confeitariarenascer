import SalesWorkspace from "@/app/operacao/components/SalesWorkspace";
import { hasPermission, PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export default async function CommandsPage() {
  const session = await requirePermissionSession(PERMISSIONS.COMMANDS_RECEIVE, "staff");
  return <SalesWorkspace channel="comanda" canCancel={hasPermission(session.role, PERMISSIONS.SALES_CANCEL)} />;
}
