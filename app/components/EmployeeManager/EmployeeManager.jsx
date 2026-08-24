"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./EmployeeManager.module.css";

const emptyForm = {
  fullName: "",
  username: "",
  password: "",
  role: "atendente",
  active: true,
};

function roleLabel(role) {
  return role === "gerente" ? "Gerente" : "Atendente";
}

export default function EmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
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
      setEmployees(await request("/api/management/employees"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    active: employees.filter((item) => item.active).length,
    managers: employees.filter((item) => item.active && item.role === "gerente").length,
    attendants: employees.filter((item) => item.active && item.role === "atendente").length,
  }), [employees]);

  function feedback(text) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 2800);
  }

  function startEdit(employee) {
    setEditingId(employee.id);
    setForm({
      fullName: employee.full_name,
      username: employee.username,
      password: "",
      role: employee.role,
      active: employee.active,
    });
    document.getElementById("employee-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await request(`/api/management/employees/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            username: form.username,
            role: form.role,
            active: form.active,
          }),
        });
        feedback("Funcionário atualizado.");
      } else {
        await request("/api/management/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        feedback("Funcionário cadastrado.");
      }

      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(employee) {
    const password = window.prompt(`Nova senha para ${employee.full_name}:`);
    if (!password) return;

    try {
      await request(`/api/management/employees/${employee.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      feedback("Senha alterada e sessões antigas encerradas.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(employee) {
    const active = !employee.active;
    const action = active ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} ${employee.full_name}?`)) return;

    try {
      await request(`/api/management/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: employee.full_name,
          username: employee.username,
          role: employee.role,
          active,
        }),
      });
      feedback(active ? "Funcionário reativado." : "Funcionário desativado e sessões encerradas.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>EQUIPE</span>
          <h1>Funcionários</h1>
          <p>Crie os acessos por usuário e senha e defina o papel de cada pessoa na operação.</p>
        </div>
      </header>

      <section className={styles.stats}>
        <article><strong>{stats.active}</strong><span>Ativos</span></article>
        <article><strong>{stats.managers}</strong><span>Gerentes</span></article>
        <article><strong>{stats.attendants}</strong><span>Atendentes</span></article>
      </section>

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.panel} id="employee-form">
        <div className={styles.panelHead}>
          <div><h2>{editingId ? "Editar funcionário" : "Novo funcionário"}</h2><p>Funcionários não precisam de e-mail para acessar o sistema.</p></div>
        </div>

        <form className={styles.formGrid} onSubmit={submit}>
          <label>Nome completo<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label>Usuário<input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required /></label>
          {!editingId && <label>Senha<input type="password" autoComplete="new-password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>}
          <label>Cargo<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="atendente">Atendente</option><option value="gerente">Gerente</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Acesso ativo</label>
          <div className={styles.actions}>
            {editingId && <button type="button" className={styles.secondary} onClick={cancelEdit}>Cancelar</button>}
            <button disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar funcionário"}</button>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Equipe cadastrada</h2><p>Desativar um funcionário encerra as sessões de acesso dele.</p></div></div>
        {loading ? <p className={styles.loading}>Carregando equipe...</p> : (
          <div className={styles.list}>
            {employees.length === 0 && <div className={styles.empty}>Nenhum funcionário cadastrado ainda.</div>}
            {employees.map((employee) => (
              <article key={employee.id} className={!employee.active ? styles.inactive : ""}>
                <div className={styles.identity}>
                  <span>{employee.full_name.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{employee.full_name}</strong><small>@{employee.username}</small></div>
                </div>
                <div className={styles.role}><strong>{roleLabel(employee.role)}</strong><small>{employee.active ? "Acesso ativo" : "Desativado"}</small></div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => startEdit(employee)}>Editar</button>
                  <button type="button" onClick={() => resetPassword(employee)}>Nova senha</button>
                  <button type="button" onClick={() => toggleActive(employee)}>{employee.active ? "Desativar" : "Reativar"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
