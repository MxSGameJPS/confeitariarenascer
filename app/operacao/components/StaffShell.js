"use client";

import { usePathname, useRouter } from "next/navigation";
import { ROLES } from "@/src/config/permissions";
import {
  OperationNotificationsProvider,
  useOperationNotifications,
} from "./OperationNotifications";
import styles from "./StaffShell.module.css";

const NAV_ITEMS = [
  { href: "/operacao", label: "Visão geral" },
  { href: "/operacao/delivery", label: "Delivery", channel: "delivery" },
  { href: "/operacao/comandas", label: "Comandas", channel: "comanda" },
  { href: "/operacao/caixa", label: "Frente de caixa" },
];

function StaffShellContent({ session, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { counts, soundEnabled, toggleSound } = useOperationNotifications();
  const items = session.role === ROLES.GERENTE
    ? [
        ...NAV_ITEMS,
        { href: "/operacao/mesas", label: "Mesas" },
        { href: "/operacao/funcionarios", label: "Funcionários" },
      ]
    : NAV_ITEMS;

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
          <div>
            <strong>Renascer</strong>
            <small>Operação</small>
          </div>
        </a>

        <nav className={styles.nav}>
          {items.map((item) => {
            const active = pathname === item.href;
            const count = item.channel ? counts[item.channel] ?? 0 : 0;

            return (
              <a
                key={item.href}
                href={item.href}
                className={active ? styles.active : ""}
              >
                <span className={styles.navLabel}>{item.label}</span>
                {count > 0 && (
                  <strong
                    className={styles.badge}
                    aria-label={`${count} pendência${count > 1 ? "s" : ""}`}
                  >
                    {count > 99 ? "99+" : count}
                  </strong>
                )}
              </a>
            );
          })}
        </nav>

        <button
          type="button"
          className={`${styles.soundControl} ${soundEnabled ? styles.soundOn : ""}`}
          onClick={toggleSound}
        >
          <span className={styles.soundDot} aria-hidden="true" />
          <span>
            <strong>{soundEnabled ? "Alertas sonoros ativos" : "Alertas silenciados"}</strong>
            <small>Delivery e comandas</small>
          </span>
        </button>

        <div className={styles.user}>
          <div>
            <strong>{session.fullName}</strong>
            <small>
              {session.role === ROLES.GERENTE ? "Gerente" : "Atendente"} · @{session.username}
            </small>
          </div>
          <button type="button" onClick={logout}>Encerrar turno</button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export default function StaffShell({ session, children }) {
  return (
    <OperationNotificationsProvider>
      <StaffShellContent session={session}>{children}</StaffShellContent>
    </OperationNotificationsProvider>
  );
}
