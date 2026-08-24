"use client";

import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

const NAV = [
  { href: "/admin", label: "Cardápio" },
  { href: "/admin/funcionarios", label: "Funcionários" },
];

export default function AdminShell({ session, children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a href="/admin" className={styles.brand}>
          <span>R</span>
          <div>
            <strong>Renascer</strong>
            <small>Superadmin</small>
          </div>
        </a>

        <nav className={styles.nav}>
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className={pathname === item.href ? styles.active : ""}>{item.label}</a>
          ))}
          <span>Pedidos <em>em breve</em></span>
          <span>Financeiro <em>em breve</em></span>
          <span>Fornecedores <em>em breve</em></span>
          <span>Relatórios <em>em breve</em></span>
          <span>Auditoria <em>em breve</em></span>
        </nav>

        <div className={styles.user}>
          <div>
            <strong>{session.fullName}</strong>
            <small>{session.email}</small>
          </div>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
