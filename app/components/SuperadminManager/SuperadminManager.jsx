"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./SuperadminManager.module.css";

const emptyForm = { fullName: "", email: "", password: "" };

export default function SuperadminManager({ currentUserId }) {
  const [data, setData] = useState({ admins: [], pending: [] });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || "Não foi possível concluir a operação.");
    return body.data;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await request("/api/admin/superadmins"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const result = await request("/api/admin/superadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setMessage(result.manualCreationRequired
        ? result.message
        : "Superadmin criado. Teste o novo acesso antes de desativar o usuário de homologação.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(admin) {
    if (!window.confirm(`Desativar o acesso administrativo de ${admin.full_name}?`)) return;
    try {
      await request(`/api/admin/superadmins/${admin.id}`, { method: "DELETE" });
      setMessage("Superadmin desativado.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.page}>
      <header>
        <span>CONTROLE DE ACESSO</span>
        <h1>Superadmins</h1>
        <p>Aqui é feita a passagem do acesso de homologação para o administrador definitivo da padaria.</p>
      </header>

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><h2>Cadastrar administrador definitivo</h2><p>Este acesso usa e-mail e senha e possui controle total do sistema.</p></div>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <label>Nome completo<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label>E-mail<input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} required /></label>
          <label>Senha inicial<input type="password" autoComplete="new-password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <button disabled={saving}>{saving ? "Criando..." : "Criar Superadmin"}</button>
        </form>
        <div className={styles.notice}><strong>Entrega segura</strong><span>Crie o administrador real, abra uma nova janela e confirme que ele consegue entrar. Só depois desative o acesso de teste.</span></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Administradores</h2><p>Contas com acesso completo.</p></div></div>
        {loading ? <p className={styles.loading}>Carregando...</p> : <div className={styles.list}>
          {data.admins.map((admin) => (
            <article key={admin.id} className={!admin.active ? styles.inactive : ""}>
              <div><strong>{admin.full_name}</strong><small>{admin.email || "E-mail não informado"}</small></div>
              <span>{admin.id === currentUserId ? "Sessão atual" : admin.active ? "Ativo" : "Desativado"}</span>
              {admin.active && admin.id !== currentUserId && <button type="button" onClick={() => deactivate(admin)}>Desativar</button>}
            </article>
          ))}
        </div>}
      </section>

      {data.pending.length > 0 && <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Autorizações pendentes</h2><p>Se a criação automática do Auth não funcionar, crie o mesmo e-mail em Authentication &gt; Users no Supabase.</p></div></div>
        <div className={styles.list}>{data.pending.map((item) => <article key={item.id}><div><strong>{item.full_name}</strong><small>{item.email}</small></div><span>Aguardando Auth</span></article>)}</div>
      </section>}
    </div>
  );
}
