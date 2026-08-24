"use client";

import { usePathname, useRouter } from "next/navigation";
import { ROLES } from "@/src/config/permissions";
import styles from "./StaffShell.module.css";

const NAV_ITEMS = [
  { href: "/operacao", label: "Visão geral" },
  { href: "/operacao/delivery", label: "Delivery", permission: "attendant" },
  { href: "/operacao/comandas", label: "Comandas", permission: "attendant" },
  { href: "/operacao/caixa", label: "Frente de caixa" },
];

export default function StaffShell({ session, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = NAV_ITEMS.filter((item) => item.permission !== "attendant" || session.role === ROLES.ATENDENTE);
  const items = session.role === ROLES.GERENTE
    ? [...allowed, { href: "/operacao/funcionarios", label: "Funcionários" }]
    : allowed;

  async function logout() {
    await fetch("/api/staff/auth/logout", { method: "POST" });
    router.replace("/operacao/login");
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="/operacao">
          <span>R</span>
          <div><strong>Renascer</strong><small>Operação</small></div>
        </a>

        <nav className={styles.nav}>
          {items.map((item) => {
            const active = pathname === item.href;
            return <a key={item.href} href={item.href} className={active ? styles.active : ""}>{item.label}</a>;
          })}
        </nav>

        <div className={styles.user}>
          <div>
            <strong>{session.fullName}</strong>
            <small>{session.role === ROLES.GERENTE ? "Gerente" : "Atendente"} · @{session.username}</small>
          </div>
          <button type="button" onClick={logout}>Encerrar turno</button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
