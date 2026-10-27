"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./PhysicalCommands.module.css";

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const code = (number) => `C${number}`;
const physicalNumber = (sale) => {
  const label = String(sale.command_label || "").trim();
  const match = /^C?(\d+)$/i.exec(label);
  return match ? Number(match[1]) : null;
};
async function getData(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "Não foi possível completar a operação.");
  return body.data || [];
}

export default function PhysicalCommands({ admin = false }) {
  const [catalog, setCatalog] = useState([]);
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState("abertas");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const headers = useMemo(() => ({ "x-renascer-surface": admin ? "admin" : "staff" }), [admin]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [registered, current] = await Promise.all([
        getData("/api/management/physical-commands", { headers }),
        getData("/api/sales?channel=comanda", { headers }),
      ]);
      setCatalog(registered);
      setSales(current);
    } catch (err) { setError(err.message); }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const opened = useMemo(() => sales.filter((sale) => sale.status === "aberto" && sale.channel === "comanda"), [sales]);
  const occupied = useMemo(() => new Set(opened.map(physicalNumber).filter(Boolean)), [opened]);
  const rows = useMemo(() => {
    if (filter === "abertas") return opened.map((sale) => ({
      key: sale.id, number: physicalNumber(sale), sale, label: sale.command_label || `Pedido #${sale.order_number}`,
      active: true,
    })).filter((row) => !search || String(row.number || row.label).toLowerCase().includes(search.toLowerCase()));
    return catalog.filter((entry) => (filter !== "disponiveis" || (entry.active && !occupied.has(Number(entry.command_number))))
      && (!search || String(entry.command_number).includes(search)))
      .map((entry) => ({ key: entry.id, number: Number(entry.command_number), active: entry.active, sale: opened.find((sale) => physicalNumber(sale) === Number(entry.command_number)) }));
  }, [filter, opened, catalog, occupied, search]);

  async function register(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/management/physical-commands", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ start, end: end || start }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Cadastro não realizado.");
      setMessage(`${body.inserted} comanda(s) cadastrada(s). Números já existentes foram preservados.`);
      setStart(""); setEnd(""); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function changeActive(row) {
    if (row.sale && row.active) { setError("Encerre o atendimento antes de desativar esta comanda."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await getData(`/api/management/physical-commands/${row.key}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      setMessage("Cadastro atualizado."); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function close(sale) {
    if (!window.confirm(`Fechar a comanda ${physicalNumber(sale) ? code(physicalNumber(sale)) : sale.order_number} no valor de ${money(sale.total)}? Confirme somente após receber o pagamento.`)) return;
    const total = Number(sale.total || 0);
    const method = total > 0 ? window.prompt("Forma de pagamento: dinheiro, pix, debito ou credito", "dinheiro") : "dinheiro";
    if (method === null) return;
    const normalized = method.trim().toLowerCase();
    if (!["dinheiro", "pix", "debito", "credito"].includes(normalized)) { setError("Forma de pagamento inválida."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/sales/${sale.id}/close`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ payments: total > 0 ? [{ method: normalized, amount: total }] : [] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível fechar a comanda.");
      setMessage("Comanda encerrada. O registro da venda foi preservado."); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className={styles.root}>
      <header className={styles.heading}>
        <div><small>{admin ? "ADMINISTRAÇÃO" : "RENASCER PESAGEM"}</small><h2>Comandas</h2>
          <p>Consulte as comandas em atendimento e o estoque de comandas físicas numeradas.</p></div>
        <button type="button" onClick={load} disabled={busy}>Atualizar</button>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {admin && <form className={styles.form} onSubmit={register}>
        <h3>Cadastrar comandas numeradas</h3><p>Cadastre uma unidade ou um intervalo de números impressos nas comandas físicas.</p>
        <div><label>Primeiro número<input required type="number" min="1" max="999999999999" value={start} onChange={(e) => setStart(e.target.value)} placeholder="101" /></label>
        <label>Último número (opcional)<input type="number" min="1" max="999999999999" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="150" /></label>
        <button disabled={busy}>Cadastrar</button></div>
      </form>}
      <nav className={styles.tabs} aria-label="Filtrar comandas">
        {[[ "abertas", `Abertas (${opened.length})` ], [ "todas", `Cadastradas (${catalog.length})` ], [ "disponiveis", "Disponíveis" ]].map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? styles.active : ""} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </nav>
      <input className={styles.search} aria-label="Buscar número da comanda" placeholder="Buscar número da comanda" value={search} onChange={(e) => setSearch(e.target.value)} inputMode="numeric" />
      <div className={styles.grid}>
        {rows.map((row) => <article key={row.key} className={styles.item}>
          <div><strong>{row.number ? code(row.number) : row.label}</strong>
          <span>{row.sale ? `Em atendimento · ${money(row.sale.total)}` : row.active ? "Disponível" : "Inativa"}</span>
          {row.sale?.table?.table_number && <small>Mesa {row.sale.table.table_number}</small>}</div>
          {row.sale && <button type="button" disabled={busy} onClick={() => close(row.sale)}>Fechar comanda</button>}
          {admin && filter !== "abertas" && <button type="button" disabled={busy} onClick={() => changeActive(row)}>{row.active ? "Desativar" : "Ativar"}</button>}
        </article>)}
      </div>
      {!rows.length && <p className={styles.empty}>Nenhuma comanda encontrada neste filtro.</p>}
      <p className={styles.note}>As comandas cadastradas são o inventário físico. Comandas abertas representam atendimentos ativos; o histórico financeiro permanece separado.</p>
    </section>
  );
}
