"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const labels = {
  pendente: "Pedido enviado",
  confirmado: "Pedido aceito",
  em_preparo: "Em preparo",
  pronto: "Pedido pronto",
  saiu_entrega: "Saiu para entrega",
  concluido: "Pedido concluído",
  cancelado: "Pedido cancelado",
};

export default function TrackingClient({ token }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/track/${token}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Pedido não encontrado.");
      setOrder(body.data);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 15000);
    return () => { window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [load]);

  if (!order) {
    return <main className={styles.page}><section className={styles.card}><h1>Acompanhar pedido</h1><p>{error || "Carregando seu pedido..."}</p>{error && <button onClick={load}>Tentar novamente</button>}</section></main>;
  }

  const delivery = order.fulfillment_type === "entrega";
  const stages = delivery
    ? ["pendente", "confirmado", "em_preparo", "pronto", "saiu_entrega", "concluido"]
    : ["pendente", "confirmado", "em_preparo", "pronto", "concluido"];
  const currentIndex = stages.indexOf(order.status);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/">Renascer</Link>
        <span className={styles.eyebrow}>PEDIDO #{order.order_number}</span>
        <h1>{labels[order.status] || order.status}</h1>
        <p className={styles.lead}>Atualizamos esta página automaticamente enquanto seu pedido avança.</p>

        {order.status === "cancelado" ? <div className={styles.canceled}>Este pedido foi cancelado. Entre em contato com a padaria se precisar de ajuda.</div> : (
          <ol className={styles.timeline}>
            {stages.map((stage, index) => <li key={stage} data-active={index <= currentIndex}><span>{index + 1}</span><strong>{labels[stage]}</strong></li>)}
          </ol>
        )}

        <div className={styles.details}>
          <div><span>Recebimento</span><strong>{delivery ? "Entrega" : "Retirada no balcão"}</strong></div>
          <div><span>Pagamento</span><strong>{order.payment_status === "pago" ? "Pago" : `Na ${delivery ? "entrega" : "retirada"}`}</strong></div>
        </div>

        <ul className={styles.items}>{order.items.filter((item) => item.status !== "cancelado").map((item, index) => (
          <li key={`${item.product_name}-${index}`}><span>{item.quantity}× {item.product_name}</span><strong>{item.pricing_mode === "variable" && item.unit_price === 0 ? "Após pesagem" : money.format(item.subtotal)}</strong></li>
        ))}</ul>
        <div className={styles.total}><span>Total atual</span><strong>{money.format(order.total)}</strong></div>
        <small>Pagamento presencial. Nenhuma cobrança é realizada por esta página.</small>
      </section>
    </main>
  );
}

