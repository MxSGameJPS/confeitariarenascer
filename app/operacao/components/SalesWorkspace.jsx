"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToSupabaseBroadcast } from "@/src/shared/realtime/supabase-broadcast";
import { formatCommandCode } from "@/src/shared/formatters/command-code";
import OperationalProductSearch from "./OperationalProductSearch";
import styles from "./SalesWorkspace.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LABELS = { delivery: "Delivery", pos: "Frente de caixa", comanda: "Comandas" };

function commandCode(sale) {
  const physical = String(sale?.command_label || "").trim().toUpperCase();
  return /^C[0-9]+$/.test(physical) ? physical : formatCommandCode(sale.order_number);
}

export default function SalesWorkspace({ channel, canCancel = false, surface = "staff" }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [variablePrices, setVariablePrices] = useState({});
  const [manualItems, setManualItems] = useState([]);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);
  const [commandOrderId, setCommandOrderId] = useState("");
  const [method, setMethod] = useState("dinheiro");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const realtimeRefresh = useRef(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/sales?channel=${channel}`, {
      headers: { "x-renascer-surface": surface },
      cache: "no-store",
    });
    const body = await response.json();
    if (response.ok) setSales(body.data ?? []);
  }, [channel, surface]);

  useEffect(() => {
    let active = true;
    fetch(`/api/sales?channel=${channel}`, {
      headers: { "x-renascer-surface": surface },
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((body) => {
        if (active && body.data) setSales(body.data);
      });
    return () => {
      active = false;
    };
  }, [channel, surface]);

  useEffect(() => {
    if (channel !== "comanda" && channel !== "delivery") return;
    let unsubscribe = () => {};
    unsubscribe = subscribeToSupabaseBroadcast({
      channel: `renascer:${channel}`,
      onChange: () => {
        window.clearTimeout(realtimeRefresh.current);
        realtimeRefresh.current = window.setTimeout(load, 120);
      },
    });
    return () => {
      unsubscribe();
      window.clearTimeout(realtimeRefresh.current);
    };
  }, [channel, load]);

  const selected = useMemo(
    () => products
      .filter((product) => cart[product.id])
      .map((product) => ({
        ...product,
        price: variablePrices[product.id] ?? product.price,
        quantity: cart[product.id],
      })),
    [cart, products, variablePrices],
  );

  const allItems = useMemo(
    () => [
      ...selected.map((item) => ({
        key: item.id,
        productId: item.id,
        name: item.name,
        unitPrice: item.price,
        pricing_mode: item.pricing_mode,
        quantity: item.quantity,
      })),
      ...manualItems,
    ],
    [manualItems, selected],
  );

  const total = allItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = allItems.reduce((sum, item) => sum + item.quantity, 0);

  function errorMessage(body) {
    return body?.error?.message || "Não foi possível concluir a operação.";
  }

  async function action(url, payload = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-renascer-surface": surface,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      await load();
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCatalogProduct(product) {
    let chosenPrice = Number(product.price);

    if (product.pricing_mode === "variable" && !variablePrices[product.id]) {
      const value = window.prompt(
        `Informe o valor calculado após pesar “${product.name}”:`,
        "",
      );
      const parsed = Number(String(value ?? "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMessage("Informe um valor válido para o produto pesado.");
        return false;
      }
      chosenPrice = Number(parsed.toFixed(2));
      setVariablePrices((current) => ({ ...current, [product.id]: chosenPrice }));
    }

    setProducts((current) => {
      const exists = current.some((entry) => entry.id === product.id);
      return exists
        ? current.map((entry) => entry.id === product.id ? { ...entry, ...product } : entry)
        : [...current, product];
    });
    setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
    setMessage("");
    return true;
  }

  async function createSale(event) {
    event.preventDefault();
    const payload = {
      channel,
      commandLabel: null,
      items: allItems.map((item) => item.productId
        ? {
            productId: item.productId,
            quantity: item.quantity,
            ...(item.pricing_mode === "variable" ? { unitPrice: item.unitPrice } : {}),
          }
        : {
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          }),
      payments: channel === "pos"
        ? [{ method, amount: Number(total.toFixed(2)) }]
        : [],
    };

    const target = channel === "comanda"
      ? `/api/sales/${commandOrderId}/items`
      : "/api/sales";

    if (channel === "comanda" && !commandOrderId) {
      setMessage("Selecione uma comanda aberta.");
      return;
    }

    const saved = await action(
      target,
      channel === "comanda" ? { items: payload.items } : payload,
    );
    if (saved) {
      setCart({});
      setProducts([]);
      setVariablePrices({});
      setManualItems([]);
      setMessage(channel === "comanda" ? "Itens adicionados à comanda." : "Venda registrada com sucesso.");
    }
  }

  function addManualItem(event) {
    event.preventDefault();
    const price = Number(String(manualPrice).replace(",", "."));
    const quantity = Number(manualQuantity);
    if (
      manualName.trim().length < 2
      || !Number.isFinite(price)
      || price <= 0
      || !Number.isInteger(quantity)
      || quantity < 1
    ) {
      setMessage("Informe descrição, preço e quantidade válidos para o item avulso.");
      return;
    }
    setManualItems((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: null,
        name: manualName.trim(),
        unitPrice: Number(price.toFixed(2)),
        quantity,
      },
    ]);
    setManualName("");
    setManualPrice("");
    setManualQuantity(1);
    setMessage("");
  }

  function changeCatalogQuantity(productId, delta) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;

    if (delta > 0 && product.pricing_mode === "variable" && !variablePrices[productId]) {
      const value = window.prompt(
        `Informe o valor calculado após pesar “${product.name}”:`,
        "",
      );
      const parsed = Number(String(value ?? "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMessage("Informe um valor válido para o produto pesado.");
        return;
      }
      setVariablePrices((current) => ({
        ...current,
        [productId]: Number(parsed.toFixed(2)),
      }));
    }

    setCart((current) => {
      const quantity = Math.max(0, (current[productId] || 0) + delta);
      const next = { ...current };
      if (quantity) next[productId] = quantity;
      else delete next[productId];
      return next;
    });
  }

  async function acceptRequest(sale, request) {
    const requestItems = sale.items.filter((item) => item.request_id === request.id);
    const prices = [];
    for (const item of requestItems.filter((entry) => entry.pricing_mode === "variable")) {
      const value = window.prompt(`Informe o valor unitário após pesar “${item.product_name}”:`, "");
      const parsed = Number(String(value ?? "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMessage("A pesagem precisa de um valor válido.");
        return;
      }
      prices.push({ itemId: item.id, unitPrice: Number(parsed.toFixed(2)) });
    }
    await action(`/api/command-requests/${request.id}/accept`, { variablePrices: prices });
  }

  async function rejectRequest(request) {
    const reason = window.prompt("Informe por que este pedido não poderá ser atendido:");
    if (!reason) return;
    await action(`/api/command-requests/${request.id}/reject`, { reason });
  }

  async function acceptDelivery(sale) {
    const prices = [];
    for (const item of sale.items.filter((entry) => entry.pricing_mode === "variable" && entry.status === "ativo")) {
      const value = window.prompt(`Informe o valor unitário após pesar “${item.product_name}”:`, "");
      const parsed = Number(String(value ?? "").replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMessage("A pesagem precisa de um valor válido.");
        return;
      }
      prices.push({ itemId: item.id, unitPrice: Number(parsed.toFixed(2)) });
    }
    await action(`/api/sales/${sale.id}/accept`, { variablePrices: prices });
  }

  function deliveryNextAction(sale) {
    if (sale.status === "confirmado") return { status: "em_preparo", label: "Iniciar preparo" };
    if (sale.status === "em_preparo") return { status: "pronto", label: "Marcar como pronto" };
    if (sale.status === "pronto" && sale.fulfillment_type === "entrega") {
      return { status: "saiu_entrega", label: "Saiu para entrega" };
    }
    if (sale.status === "pronto") return { status: "concluido", label: "Entregar e receber" };
    if (sale.status === "saiu_entrega") return { status: "concluido", label: "Concluir e receber" };
    return null;
  }

  async function closeCommand(sale) {
    const selectedMethod = window.prompt(
      "Forma de pagamento: dinheiro, pix, credito ou debito",
      "dinheiro",
    );
    if (!selectedMethod) return;
    await action(`/api/sales/${sale.id}/close`, {
      payments: [{ method: selectedMethod, amount: sale.total }],
    });
  }

  async function cancel(sale, itemId = null) {
    const reason = window.prompt("Informe o motivo do cancelamento:");
    if (!reason) return;
    const path = itemId
      ? `/api/sales/${sale.id}/items/cancel`
      : `/api/sales/${sale.id}/cancel`;
    await action(path, itemId ? { itemId, reason } : { reason });
  }

  return (
    <div className={styles.workspace}>
      <header>
        <span>OPERAÇÃO UNIFICADA</span>
        <h1>{LABELS[channel]}</h1>
        <p>Itens, pagamentos, responsável, auditoria e financeiro no mesmo registro.</p>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      {channel !== "delivery" && (
        <section className={styles.saleForm}>
          <div className={styles.formTop}>
            <strong>{channel === "pos" ? "Nova venda avulsa" : "Adicionar itens à comanda"}</strong>
            {channel === "comanda" && (
              <select
                value={commandOrderId}
                onChange={(event) => setCommandOrderId(event.target.value)}
                required
              >
                <option value="">Selecione uma comanda aberta</option>
                {sales
                  .filter((sale) => sale.status === "aberto")
                  .map((sale) => (
                    <option value={sale.id} key={sale.id}>
                      {commandCode(sale)} · {sale.table ? `Mesa ${sale.table.table_number}` : sale.command_label || "Balcão"}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div className={styles.posGrid}>
            <div className={styles.catalogPane}>
              <OperationalProductSearch
                context={channel}
                surface={surface}
                onSelect={addCatalogProduct}
                disabled={busy}
                autoFocus={channel === "pos"}
              />

              <form className={styles.manualForm} onSubmit={addManualItem}>
                <strong>Item avulso</strong>
                <input
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  placeholder="Descrição do produto"
                />
                <input
                  value={manualPrice}
                  onChange={(event) => setManualPrice(event.target.value)}
                  inputMode="decimal"
                  placeholder="Preço unitário"
                />
                <input
                  value={manualQuantity}
                  onChange={(event) => setManualQuantity(Number(event.target.value))}
                  type="number"
                  min="1"
                  max="99"
                  aria-label="Quantidade"
                />
                <button>Adicionar item</button>
              </form>
            </div>

            <form className={styles.cartPane} onSubmit={createSale}>
              <div className={styles.cartTitle}>
                <strong>Carrinho</strong>
                <span>{itemCount} item(ns)</span>
              </div>

              {allItems.length === 0 && (
                <p className={styles.empty}>Busque um produto por código, referência ou nome para adicioná-lo.</p>
              )}

              <ul className={styles.cartList}>
                {allItems.map((item) => (
                  <li key={item.key}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{money.format(item.unitPrice)} cada</small>
                    </div>
                    <div className={styles.quantity}>
                      {item.productId && (
                        <button type="button" onClick={() => changeCatalogQuantity(item.productId, -1)}>−</button>
                      )}
                      <span>{item.quantity}</span>
                      {item.productId && (
                        <button type="button" onClick={() => changeCatalogQuantity(item.productId, 1)}>+</button>
                      )}
                      {!item.productId && (
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => setManualItems((current) => current.filter((entry) => entry.key !== item.key))}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <b>{money.format(item.unitPrice * item.quantity)}</b>
                  </li>
                ))}
              </ul>

              <div className={styles.payment}>
                <div>
                  <span>Total</span>
                  <strong>{money.format(total)}</strong>
                </div>
                {channel === "pos" && (
                  <label>
                    <span>Forma de pagamento</span>
                    <select value={method} onChange={(event) => setMethod(event.target.value)}>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </label>
                )}
                <button disabled={busy || allItems.length === 0 || (channel === "comanda" && !commandOrderId)}>
                  {busy ? "Salvando..." : channel === "pos" ? "Concluir venda" : "Adicionar à comanda"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <section className={styles.list}>
        <div className={styles.listTitle}>
          <strong>{channel === "delivery" ? "Pedidos recebidos" : "Registros recentes"}</strong>
          <button type="button" onClick={load}>Atualizar</button>
        </div>

        {sales.length === 0 && <p className={styles.empty}>Nenhum registro real encontrado.</p>}

        {sales.map((sale) => {
          const nextDeliveryAction = channel === "delivery" ? deliveryNextAction(sale) : null;
          return (
            <article key={sale.id}>
              <div className={styles.saleHead}>
                <div>
                  <small>{sale.channel === "comanda" ? commandCode(sale) : `#${sale.order_number}`}</small>
                  <strong>{sale.command_label || sale.customer?.name || LABELS[sale.channel]}</strong>
                </div>
                <div>
                  <b>{money.format(sale.total)}</b>
                  <span data-status={sale.status}>{sale.status.replaceAll("_", " ")}</span>
                </div>
              </div>

              {channel === "delivery" && (
                <div className={styles.deliveryInfo}>
                  <span>
                    {sale.fulfillment_type === "entrega"
                      ? `${sale.address_street}, ${sale.address_number} · ${sale.address_neighborhood}`
                      : "Retirada no balcão"}
                  </span>
                  <span>
                    {sale.customer?.phone} · {sale.payment_method}
                    {sale.change_for ? ` · troco para ${money.format(sale.change_for)}` : ""}
                  </span>
                  {sale.notes && <small>{sale.notes}</small>}
                </div>
              )}

              <ul>
                {sale.items.map((item) => (
                  <li key={item.id} className={item.status === "cancelado" ? styles.canceled : ""}>
                    <span>{item.quantity}× {item.product_name}</span>
                    <span>
                      {money.format(item.subtotal)}
                      {canCancel && item.status === "ativo" && sale.status !== "cancelado" && (
                        <button type="button" onClick={() => cancel(sale, item.id)}>Cancelar item</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {channel === "comanda" && (sale.requests ?? [])
                .filter((request) => request.status === "pendente")
                .map((request) => (
                  <div className={styles.request} key={request.id}>
                    <div>
                      <strong>Novo pedido do QR</strong>
                      <span>{request.customer_name || (sale.table ? `Mesa ${sale.table.table_number}` : "Cliente da mesa")}</span>
                      <ul>
                        {sale.items
                          .filter((item) => item.request_id === request.id && item.status === "ativo")
                          .map((item) => <li key={item.id}>{item.quantity}× {item.product_name}</li>)}
                      </ul>
                      <small>{request.notes || "Sem observações"}</small>
                    </div>
                    <div className={styles.requestActions}>
                      <button disabled={busy} onClick={() => acceptRequest(sale, request)}>Aceitar pedido</button>
                      <button className={styles.reject} disabled={busy} onClick={() => rejectRequest(request)}>Recusar</button>
                    </div>
                  </div>
                ))}

              <footer>
                <small>
                  {new Date(sale.created_at).toLocaleString("pt-BR")}
                  {sale.responsible_employee ? ` · ${sale.responsible_employee.full_name}` : ""}
                </small>
                <div>
                  {channel === "delivery" && sale.status === "pendente" && (
                    <button disabled={busy} onClick={() => acceptDelivery(sale)}>Aceitar pedido</button>
                  )}
                  {channel === "delivery" && nextDeliveryAction && (
                    <button
                      disabled={busy}
                      onClick={() => action(`/api/sales/${sale.id}/status`, { status: nextDeliveryAction.status })}
                    >
                      {nextDeliveryAction.label}
                    </button>
                  )}
                  {channel === "comanda" && sale.status === "aberto" && (
                    <button disabled={busy} onClick={() => closeCommand(sale)} title="Contingência: fechamento manual pelo navegador">
                      Receber e fechar
                    </button>
                  )}
                  {canCancel && sale.status !== "cancelado" && (
                    <button className={styles.danger} disabled={busy} onClick={() => cancel(sale)}>Cancelar venda</button>
                  )}
                </div>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
