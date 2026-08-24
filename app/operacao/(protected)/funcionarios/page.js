import { redirect } from "next/navigation";
import EmployeeManager from "@/app/components/EmployeeManager/EmployeeManager";
import { requireStaffSession } from "@/src/shared/auth/staff-session";
import { ROLES } from "@/src/config/permissions";

export default async function StaffEmployeesPage() {
  const session = await requireStaffSession();
  if (session.role !== ROLES.GERENTE) redirect("/operacao");
  return <EmployeeManager surface="staff" />;
}
