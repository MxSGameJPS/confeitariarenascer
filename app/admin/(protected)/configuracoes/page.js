import DeliverySettings from "@/app/admin/components/DeliverySettings";
import { requireAdminSession } from "@/src/shared/auth/admin-session";

export const metadata = { title: "Configurações do delivery | Renascer", robots: { index: false, follow: false } };

export default async function DeliverySettingsPage() {
  await requireAdminSession();
  return <DeliverySettings />;
}

