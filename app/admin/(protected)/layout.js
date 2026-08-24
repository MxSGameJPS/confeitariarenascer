import { redirect } from "next/navigation";
import { getAdminSession } from "@/src/shared/auth/admin-session";
import AdminShell from "../components/AdminShell";

export default async function ProtectedAdminLayout({ children }) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return <AdminShell session={session}>{children}</AdminShell>;
}
