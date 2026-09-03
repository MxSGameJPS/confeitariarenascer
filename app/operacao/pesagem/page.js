import { redirect } from "next/navigation";
import WeighingApp from "./components/WeighingApp";
import { PERMISSIONS, hasPermission } from "@/src/config/permissions";
import { getPrincipalSession } from "@/src/shared/auth/principal-session";

export default async function WeighingPage() {
  const session = await getPrincipalSession("staff");

  if (!session) {
    redirect("/operacao/pesagem/login");
  }

  if (!hasPermission(session.role, PERMISSIONS.WEIGHING_ACCESS)) {
    redirect("/operacao");
  }

  return <WeighingApp employee={{ id: session.id, fullName: session.fullName }} />;
}
