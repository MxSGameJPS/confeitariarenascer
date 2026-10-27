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
  const [closingSale, setClosingSale] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
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

  function openCloseModal(sale) {
    if (busy) return;
    setError("");
    setMessage("");
    setPaymentMethod("dinheiro");
    setClosingSale(sale);
  }

  async function confirmClose() {
    if (!closingSale || busy) return;
    const sale = closingSale;
    const total = Number(sale.total || 0);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Esta comanda não possui valor válido para pagamento. Verifique os itens no Caixa.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/sales/${sale.id}/close`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ payments: [{ method: paymentMethod, amount: total }] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível fechar a comanda.");
      setClosingSale(null);
      setMessage("Comanda encerrada. O registro da venda foi preservado.");
      await load();
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
          {row.sale && <button type="button" disabled={busy} onClick={() => openCloseModal(row.sale)}>Fechar comanda</button>}
          {admin && filter !== "abertas" && <button type="button" disabled={busy} onClick={() => changeActive(row)}>{row.active ? "Desativar" : "Ativar"}</button>}
        </article>)}
      </div>
      {!rows.length && <p className={styles.empty}>Nenhuma comanda encontrada neste filtro.</p>}
      {closingSale && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setClosingSale(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="close-command-title" className={styles.modal}>
            <div className={styles.modalHeading}>
              <div><span>FECHAMENTO DE COMANDA</span><h3 id="close-command-title">Comanda {physicalNumber(closingSale) ? code(physicalNumber(closingSale)) : closingSale.order_number}</h3></div>
              <button type="button" className={styles.modalDismiss} aria-label="Cancelar fechamento" disabled={busy} onClick={() => setClosingSale(null)}>×</button>
            </div>
            <p className={styles.modalDescription}>Confirme o recebimento do pagamento antes de encerrar esta comanda.</p>
            <div className={styles.modalAmount}><small>VALOR TOTAL</small><strong>{money(closingSale.total)}</strong></div>
            <fieldset className={styles.paymentMethods} disabled={busy}>
              <legend>Forma de pagamento</legend>
              {[[ "dinheiro", "Dinheiro" ], [ "pix", "Pix" ], [ "debito", "Débito" ], [ "credito", "Crédito" ]].map(([value, label]) => (
                <label key={value} className={paymentMethod === value ? styles.paymentSelected : ""}>
                  <input type="radio" name="commandPaymentMethod" value={value} checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} />{label}
                </label>
              ))}
            </fieldset>
            {error && <p className={styles.modalError} role="alert">{error}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelAction} disabled={busy} onClick={() => setClosingSale(null)}>Cancelar</button>
              <button type="button" className={styles.confirmAction} disabled={busy || Number(closingSale.total) <= 0} onClick={confirmClose}>{busy ? "Fechando..." : "Confirmar pagamento e fechar"}</button>
            </div>
          </section>
        </div>
      )}
      <p className={styles.note}>As comandas cadastradas são o inventário físico. Comandas abertas representam atendimentos ativos; o histórico financeiro permanece separado.</p>
    </section>
  );
}
