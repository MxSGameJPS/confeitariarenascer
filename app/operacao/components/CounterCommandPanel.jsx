"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CounterCommandPanel.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function apiError(body) {
  return body?.error?.message || "Não foi possível concluir a operação.";
}

export default function CounterCommandPanel({ surface = "staff" }) {
  const [sales, setSales] = useState([]);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [label, setLabel] = useState("");
  const [tableSelection, setTableSelection] = useState({});
  const [itemCommandId, setItemCommandId] = useState("");
  const [itemProductId, setItemProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const openOperation = useRef(null);
  const linkOperations = useRef({});

  const headers = useMemo(() => ({ "x-renascer-surface": surface }), [surface]);

  const load = useCallback(async () => {
    try {
      const [salesResponse, tablesResponse, productsResponse] = await Promise.all([
        fetch("/api/sales?channel=comanda", { headers, cache: "no-store" }),
        fetch("/api/management/tables", { headers, cache: "no-store" }),
        fetch("/api/products?channel=internal", { cache: "no-store" }),
      ]);
      const [salesBody, tablesBody, productsBody] = await Promise.all([
        salesResponse.json(), tablesResponse.json(), productsResponse.json(),
      ]);
      if (!salesResponse.ok) throw new Error(apiError(salesBody));
      if (!tablesResponse.ok) throw new Error(apiError(tablesBody));
      if (!productsResponse.ok) throw new Error(apiError(productsBody));
      setSales(salesBody.data ?? []);
      setTables((tablesBody.data ?? []).filter((table) => table.active && table.command_enabled));
      setProducts(productsBody.data ?? []);
    } catch (error) {
      setMessage(error.message);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const counterCommands = useMemo(
    () => sales.filter((sale) => sale.channel === "comanda" && sale.status === "aberto" && !sale.table),
    [sales]
  );

  async function openCommand(event) {
    event.preventDefault();
    const normalized = label.trim();
    if (normalized.length < 2) { setMessage("Informe o nome ou uma identificação para o cliente."); return; }
    if (!openOperation.current) openOperation.current = crypto.randomUUID();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/sales/commands", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ commandLabel: normalized, operationId: openOperation.current }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiError(body));
      openOperation.current = null;
      setLabel("");
      setItemCommandId(body.data.id);
      setMessage(`Comanda #${body.data.order_number} aberta. Agora você já pode lançar os produtos do balcão.`);
      await load();
    } catch (error) {
      setMessage(`${error.message} Você pode tentar novamente sem risco de duplicar a comanda.`);
    } finally { setBusy(false); }
  }

  function changeLabel(value) { setLabel(value); openOperation.current = null; }
  function selectTable(orderId, tableId) {
    setTableSelection((current) => ({ ...current, [orderId]: tableId }));
    delete linkOperations.current[orderId];
  }

  async function addQuickItem(event) {
    event.preventDefault();
    const command = counterCommands.find((entry) => entry.id === itemCommandId);
    const product = products.find((entry) => entry.id === itemProductId);
    const quantity = Number(itemQuantity);
    if (!command || !product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setMessage("Selecione a comanda, o produto e uma quantidade válida.");
      return;
    }

    const item = { productId: product.id, quantity };
    if (product.pricing_mode === "variable") {
      const value = window.prompt(`Informe o valor unitário após pesar “${product.name}”:`, "");
      const parsed = Number(String(value ?? "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) { setMessage("Informe um valor válido para o produto pesado."); return; }
      item.unitPrice = Number(parsed.toFixed(2));
    }

    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/sales/${command.id}/items`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiError(body));
      setItemProductId(""); setItemQuantity(1);
      setMessage(`${quantity}× ${product.name} adicionado à comanda #${command.order_number}.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function linkTable(command) {
    const tableId = tableSelection[command.id];
    if (!tableId) { setMessage("Selecione a mesa antes de vincular a comanda."); return; }
    if (!linkOperations.current[command.id]) linkOperations.current[command.id] = crypto.randomUUID();
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/sales/${command.id}/table`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, operationId: linkOperations.current[command.id] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiError(body));
      delete linkOperations.current[command.id];
      setTableSelection((current) => { const next = { ...current }; delete next[command.id]; return next; });
      if (itemCommandId === command.id) setItemCommandId("");
      setMessage(`Comanda #${command.order_number} vinculada à Mesa ${body.data.table_number}.`);
      await load();
    } catch (error) {
      setMessage(`${error.message} Você pode tentar novamente sem risco de duplicar o vínculo.`);
    } finally { setBusy(false); }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div><span>BALCÃO</span><h2>Comandas sem mesa</h2><p>Abra a comanda no primeiro pedido e vincule a mesa somente quando o cliente sentar.</p></div>
        <button type="button" className={styles.refresh} onClick={load}>Atualizar</button>
      </div>
      {message && <div className={styles.message}>{message}</div>}

      <form className={styles.openForm} onSubmit={openCommand}>
        <label><span>Nome ou identificação do cliente</span><input value={label} onChange={(event) => changeLabel(event.target.value)} maxLength={80} placeholder="Ex.: João, Maria Silva" autoComplete="off" /></label>
        <button disabled={busy || label.trim().length < 2}>{busy ? "Aguarde..." : "+ Nova comanda"}</button>
      </form>

      {counterCommands.length > 0 && (
        <form className={styles.quickAdd} onSubmit={addQuickItem}>
          <strong>Lançamento rápido no balcão</strong>
          <select value={itemCommandId} onChange={(event) => setItemCommandId(event.target.value)}>
            <option value="">Selecione a comanda...</option>
            {counterCommands.map((command) => <option key={command.id} value={command.id}>#{command.order_number} · {command.command_label}</option>)}
          </select>
          <select value={itemProductId} onChange={(event) => setItemProductId(event.target.value)}>
            <option value="">Selecione o produto...</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.pricing_mode === "variable" ? "pesagem" : money.format(Number(product.price || 0))}</option>)}
          </select>
          <input type="number" min="1" max="99" value={itemQuantity} onChange={(event) => setItemQuantity(Number(event.target.value))} aria-label="Quantidade" />
          <button disabled={busy || !itemCommandId || !itemProductId}>Adicionar produto</button>
        </form>
      )}

      <div className={styles.cards}>
        {counterCommands.length === 0 && <p className={styles.empty}>Nenhuma comanda aberta está aguardando mesa.</p>}
        {counterCommands.map((command) => (
          <article key={command.id}>
            <div className={styles.commandInfo}><span>COMANDA #{command.order_number}</span><strong>{command.command_label || "Cliente do balcão"}</strong><small>{command.items?.filter((item) => item.status === "ativo").length || 0} item(ns) · {money.format(Number(command.total || 0))}</small></div>
            <div className={styles.linkArea}>
              <select value={tableSelection[command.id] || ""} onChange={(event) => selectTable(command.id, event.target.value)} aria-label={`Mesa para a comanda ${command.order_number}`}>
                <option value="">Vincular a uma mesa...</option>
                {tables.map((table) => <option key={table.id} value={table.id}>Mesa {table.table_number} · {table.occupancy_status === "livre" ? "livre" : "em atendimento"}</option>)}
              </select>
              <button type="button" disabled={busy || !tableSelection[command.id]} onClick={() => linkTable(command)}>Vincular</button>
            </div>
          </article>
        ))}
      </div>
      <small className={styles.hint}>O número nunca muda ao sentar na mesa: C237 continua C237 no Bridge.</small>
    </section>
  );
}
