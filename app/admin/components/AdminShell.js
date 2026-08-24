"use client";

import { useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";

export default function AdminShell({ session, children }) {
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
            <small>Administração</small>
          </div>
        </a>

        <nav className={styles.nav}>
          <a href="/admin" className={styles.active}>Cardápio</a>
          <span>Pedidos <em>em breve</em></span>
          <span>Financeiro <em>em breve</em></span>
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
