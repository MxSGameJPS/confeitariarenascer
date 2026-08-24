import SuperadminManager from "@/app/components/SuperadminManager/SuperadminManager";
import { requireAdminSession } from "@/src/shared/auth/admin-session";

export default async function AdminsPage() {
  const session = await requireAdminSession();
  return <SuperadminManager currentUserId={session.id} />;
}
