import SalesWorkspace from "@/app/operacao/components/SalesWorkspace";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export default async function CommandsPage() {
  await requirePermissionSession(PERMISSIONS.COMMANDS_RECEIVE, "staff");
  return <SalesWorkspace channel="comanda" />;
}
