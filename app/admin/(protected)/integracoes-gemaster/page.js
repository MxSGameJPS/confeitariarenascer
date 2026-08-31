import GemasterIntegration from "@/app/admin/components/GemasterIntegration/GemasterIntegration";
import { PERMISSIONS } from "@/src/config/permissions";
import { requirePermissionSession } from "@/src/shared/auth/principal-session";

export const metadata = {
  title: "Integração GeMaster | Renascer",
  robots: { index: false, follow: false },
};

export default async function GemasterIntegrationPage() {
  await requirePermissionSession(PERMISSIONS.BRIDGE_MANAGE, "admin");
  return <GemasterIntegration />;
}
