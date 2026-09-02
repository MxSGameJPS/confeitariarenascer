import CounterCommandPanel from "@/app/operacao/components/CounterCommandPanel";
import SalesWorkspace from "@/app/operacao/components/SalesWorkspace";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export default async function AdminCommandsPage() {
  await requirePermissionSession(PERMISSIONS.COMMANDS_RECEIVE, "admin");
  return (
    <>
      <CounterCommandPanel surface="admin" />
      <SalesWorkspace channel="comanda" canCancel surface="admin" />
    </>
  );
}
