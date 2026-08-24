"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./SalesWorkspace.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LABELS = { delivery: "Delivery", pos: "Frente de caixa", comanda: "Comandas" };

export default function SalesWorkspace({ channel, canCancel = false }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [commandLabel, setCommandLabel] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/sales?channel=${channel}`, { headers: { "x-renascer-surface": "staff" }, cache: "no-store" });
    const body = await response.json();
    if (response.ok) setSales(body.data);
  }, [channel]);

  useEffect(() => {
    let active = true;
    fetch(`/api/sales?channel=${channel}`, { headers: { "x-renascer-surface": "staff" }, cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (active && body.data) setSales(body.data); });
    return () => { active = false; };
  }, [channel]);
  useEffect(() => {
    if (channel === "delivery") return;
    fetch("/api/products", { cache: "no-store" }).then((response) => response.json()).then((body) => setProducts(body.data ?? []));
  }, [channel]);

  const selected = useMemo(() => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, products]);
  const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function errorMessage(body) { return body?.error?.message || "Não foi possível concluir a operação."; }
  async function action(url, payload = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-renascer-surface": "staff" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      await load();
      return true;
    } catch (error) { setMessage(error.message); return false; }
    finally { setBusy(false); }
  }

  async function createSale(event) {
    event.preventDefault();
    const payload = {
      channel,
      commandLabel: channel === "comanda" ? commandLabel : null,
      items: selected.map((item) => ({ productId: item.id, quantity: item.quantity })),
      payments: channel === "pos" ? [{ method, amount: Number(total.toFixed(2)) }] : [],
    };
    if (await action("/api/sales", payload)) { setCart({}); setCommandLabel(""); setMessage("Registro salvo com sucesso."); }
  }

  async function closeCommand(sale) {
    const selectedMethod = window.prompt("Forma de pagamento: dinheiro, pix, credito ou debito", "dinheiro");
    if (!selectedMethod) return;
    await action(`/api/sales/${sale.id}/close`, { payments: [{ method: selectedMethod, amount: sale.total }] });
  }

  async function cancel(sale, itemId = null) {
    const reason = window.prompt("Informe o motivo do cancelamento:");
    if (!reason) return;
    const path = itemId ? `/api/sales/${sale.id}/items/cancel` : `/api/sales/${sale.id}/cancel`;
    await action(path, itemId ? { itemId, reason } : { reason });
  }

  return (
    <div className={styles.workspace}>
      <header><span>OPERAÇÃO UNIFICADA</span><h1>{LABELS[channel]}</h1><p>Itens, pagamentos, responsável, auditoria e financeiro no mesmo registro.</p></header>
      {message && <div className={styles.message}>{message}</div>}

      {channel !== "delivery" && (
        <form className={styles.saleForm} onSubmit={createSale}>
          <div className={styles.formTop}>
            <strong>{channel === "pos" ? "Nova venda avulsa" : "Abrir comanda"}</strong>
            {channel === "comanda" && <input value={commandLabel} onChange={(event) => setCommandLabel(event.target.value)} placeholder="Mesa ou nome da comanda" required />}
          </div>
          <div className={styles.products}>{products.map((product) => (
            <button type="button" key={product.id} onClick={() => setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))}>
              <span>{product.name}</span><small>{money.format(product.price)}</small><em>{cart[product.id] ? `${cart[product.id]} adicionado(s)` : "Adicionar"}</em>
            </button>
          ))}</div>
          <div className={styles.checkout}><span>{selected.length} itens · <strong>{money.format(total)}</strong></span>{channel === "pos" && <select value={method} onChange={(event) => setMethod(event.target.value)}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="credito">Crédito</option><option value="debito">Débito</option></select>}<button disabled={busy || selected.length === 0}>{busy ? "Salvando..." : channel === "pos" ? "Concluir venda" : "Abrir comanda"}</button></div>
        </form>
      )}

      <section className={styles.list}>
        <div className={styles.listTitle}><strong>{channel === "delivery" ? "Pedidos recebidos" : "Registros recentes"}</strong><button type="button" onClick={load}>Atualizar</button></div>
        {sales.length === 0 && <p className={styles.empty}>Nenhum registro real encontrado.</p>}
        {sales.map((sale) => (
          <article key={sale.id}>
            <div className={styles.saleHead}><div><small>#{sale.order_number}</small><strong>{sale.command_label || sale.customer?.name || LABELS[sale.channel]}</strong></div><div><b>{money.format(sale.total)}</b><span data-status={sale.status}>{sale.status.replaceAll("_", " ")}</span></div></div>
            <ul>{sale.items.map((item) => <li key={item.id} className={item.status === "cancelado" ? styles.canceled : ""}><span>{item.quantity}× {item.product_name}</span><span>{money.format(item.subtotal)}{canCancel && item.status === "ativo" && sale.status !== "cancelado" && <button type="button" onClick={() => cancel(sale, item.id)}>Cancelar item</button>}</span></li>)}</ul>
            <footer>
              <small>{new Date(sale.created_at).toLocaleString("pt-BR")}{sale.responsible_employee ? ` · ${sale.responsible_employee.full_name}` : ""}</small>
              <div>{channel === "delivery" && sale.status === "pendente" && <button disabled={busy} onClick={() => action(`/api/sales/${sale.id}/accept`)}>Aceitar pedido</button>}{channel === "comanda" && sale.status === "aberto" && <button disabled={busy} onClick={() => closeCommand(sale)}>Receber e fechar</button>}{canCancel && sale.status !== "cancelado" && <button className={styles.danger} disabled={busy} onClick={() => cancel(sale)}>Cancelar venda</button>}</div>
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}
