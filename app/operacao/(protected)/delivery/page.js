import SalesWorkspace from "@/app/operacao/components/SalesWorkspace";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export default async function DeliveryPage() {
  await requirePermissionSession(PERMISSIONS.DELIVERY_ACCEPT, "staff");
  return <SalesWorkspace channel="delivery" />;
}
