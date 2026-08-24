import { redirect } from "next/navigation";
import { getStaffSession } from "@/src/shared/auth/staff-session";
import StaffShell from "../components/StaffShell";

export default async function ProtectedOperationLayout({ children }) {
  const session = await getStaffSession();

  if (!session) {
    redirect("/operacao/login");
  }

  return <StaffShell session={session}>{children}</StaffShell>;
}
