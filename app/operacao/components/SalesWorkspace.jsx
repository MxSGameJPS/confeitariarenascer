"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./SalesWorkspace.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LABELS = { delivery: "Delivery", pos: "Frente de caixa", comanda: "Comandas" };

export default function SalesWorkspace({ channel, canCancel = false }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [manualItems, setManualItems] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);
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
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!active) return;
        setProducts(ok ? body.data ?? [] : []);
        setCatalogState(ok ? "ready" : "error");
      })
      .catch(() => { if (active) setCatalogState("error"); });
    return () => { active = false; };
  }, [channel]);

  const selected = useMemo(() => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, products]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return products;
    return products.filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(term));
  }, [products, search]);
  const allItems = useMemo(() => [
    ...selected.map((item) => ({ key: item.id, productId: item.id, name: item.name, unitPrice: item.price, quantity: item.quantity })),
    ...manualItems,
  ], [manualItems, selected]);
  const total = allItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = allItems.reduce((sum, item) => sum + item.quantity, 0);

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
      items: allItems.map((item) => item.productId
        ? { productId: item.productId, quantity: item.quantity }
        : { name: item.name, unitPrice: item.unitPrice, quantity: item.quantity }),
      payments: channel === "pos" ? [{ method, amount: Number(total.toFixed(2)) }] : [],
    };
    if (await action("/api/sales", payload)) {
      setCart({}); setManualItems([]); setCommandLabel(""); setMessage("Venda registrada com sucesso.");
    }
  }

  function addManualItem(event) {
    event.preventDefault();
    const price = Number(String(manualPrice).replace(",", "."));
    const quantity = Number(manualQuantity);
    if (manualName.trim().length < 2 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      setMessage("Informe descrição, preço e quantidade válidos para o item avulso.");
      return;
    }
    setManualItems((current) => [...current, {
      key: crypto.randomUUID(),
      productId: null,
      name: manualName.trim(),
      unitPrice: Number(price.toFixed(2)),
      quantity,
    }]);
    setManualName(""); setManualPrice(""); setManualQuantity(1); setMessage("");
  }

  function changeCatalogQuantity(productId, delta) {
    setCart((current) => {
      const quantity = Math.max(0, (current[productId] || 0) + delta);
      const next = { ...current };
      if (quantity) next[productId] = quantity;
      else delete next[productId];
      return next;
    });
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
        <section className={styles.saleForm}>
          <div className={styles.formTop}>
            <strong>{channel === "pos" ? "Nova venda avulsa" : "Abrir comanda"}</strong>
            {channel === "comanda" && <input value={commandLabel} onChange={(event) => setCommandLabel(event.target.value)} placeholder="Mesa ou nome da comanda" required />}
          </div>
          <div className={styles.posGrid}>
            <div className={styles.catalogPane}>
              <label className={styles.search}><span>Buscar produto cadastrado</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite o nome do produto" /></label>
              {catalogState === "loading" && <p className={styles.empty}>Carregando catálogo...</p>}
              {catalogState === "error" && <p className={styles.alert}>Não foi possível carregar o catálogo real. Você ainda pode lançar um item avulso abaixo.</p>}
              {catalogState === "ready" && products.length === 0 && <p className={styles.alert}>Nenhum produto ativo foi cadastrado no painel administrativo. Cadastre o cardápio real ou use item avulso.</p>}
              {catalogState === "ready" && products.length > 0 && filteredProducts.length === 0 && <p className={styles.empty}>Nenhum produto encontrado para “{search}”.</p>}
              <div className={styles.products}>{filteredProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => changeCatalogQuantity(product.id, 1)}>
                  <span>{product.name}</span><small>{money.format(product.price)}</small><em>{cart[product.id] ? `${cart[product.id]} no carrinho` : "Adicionar"}</em>
                </button>
              ))}</div>
              <form className={styles.manualForm} onSubmit={addManualItem}>
                <strong>Item avulso</strong>
                <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Descrição do produto" />
                <input value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} inputMode="decimal" placeholder="Preço unitário" />
                <input value={manualQuantity} onChange={(event) => setManualQuantity(Number(event.target.value))} type="number" min="1" max="99" aria-label="Quantidade" />
                <button>Adicionar item</button>
              </form>
            </div>

            <form className={styles.cartPane} onSubmit={createSale}>
              <div className={styles.cartTitle}><strong>Carrinho</strong><span>{itemCount} item(ns)</span></div>
              {allItems.length === 0 && <p className={styles.empty}>Adicione um produto cadastrado ou um item avulso.</p>}
              <ul className={styles.cartList}>{allItems.map((item) => (
                <li key={item.key}>
                  <div><strong>{item.name}</strong><small>{money.format(item.unitPrice)} cada</small></div>
                  <div className={styles.quantity}>
                    {item.productId && <button type="button" onClick={() => changeCatalogQuantity(item.productId, -1)}>−</button>}
                    <span>{item.quantity}</span>
                    {item.productId && <button type="button" onClick={() => changeCatalogQuantity(item.productId, 1)}>+</button>}
                    {!item.productId && <button type="button" className={styles.remove} onClick={() => setManualItems((current) => current.filter((entry) => entry.key !== item.key))}>Remover</button>}
                  </div>
                  <b>{money.format(item.unitPrice * item.quantity)}</b>
                </li>
              ))}</ul>
              <div className={styles.payment}>
                <div><span>Total</span><strong>{money.format(total)}</strong></div>
                {channel === "pos" && <label><span>Forma de pagamento</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="credito">Crédito</option><option value="debito">Débito</option></select></label>}
                <button disabled={busy || allItems.length === 0}>{busy ? "Salvando..." : channel === "pos" ? "Concluir venda" : "Abrir comanda"}</button>
              </div>
            </form>
          </div>
        </section>
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
