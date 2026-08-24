"use client";

import { useState } from "react";
import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import styles from "./CheckoutModal.module.css";

const brl = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const payments = [
  { id: "dinheiro", label: "Dinheiro", sub: "Pagamento na entrega", icon: "Money" },
  { id: "pix", label: "Pix", sub: "Pagamento na entrega", icon: "Pix" },
  { id: "credito", label: "Cartão de crédito", sub: "Maquininha na entrega", icon: "Card" },
  { id: "debito", label: "Cartão de débito", sub: "Maquininha na entrega", icon: "Card" },
];

export default function CheckoutModal() {
  const { checkout, setCheckout, total, items, clear } = useCart();
  const [fulfillmentType, setFulfillmentType] = useState("entrega");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const hasVariablePrice = items.some((item) => item.pricingMode === "variable");

  if (!checkout) return null;

  function close() {
    if (busy) return;
    setCheckout(false);
    setError("");
    setOrder(null);
  }

  async function confirm(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);

    const payload = {
      customer: { name: form.get("name"), phone: form.get("phone") },
      fulfillmentType,
      paymentMethod,
      changeFor: paymentMethod === "dinheiro" ? form.get("changeFor") || null : null,
      address: fulfillmentType === "entrega" ? {
        street: form.get("street"),
        number: form.get("number"),
        neighborhood: form.get("neighborhood"),
        complement: form.get("complement"),
        reference: form.get("reference"),
      } : null,
      notes: form.get("notes"),
      items: items.map((item) => ({ productId: item.id, quantity: item.qtd })),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível enviar o pedido.");
      setOrder(body.data);
      clear();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className={styles.head}>
          <span className={styles.title}><Icon.Receipt width={22} height={22} /> FINALIZAR PEDIDO</span>
          <button className={styles.close} onClick={close} aria-label="Fechar"><Icon.Close width={22} height={22} /></button>
        </header>

        {order ? (
          <div className={styles.sucesso}>
            <div className={styles.checkCircle}><Icon.Receipt width={40} height={40} /></div>
            <h3>Pedido #{order.order_number} recebido!</h3>
            <p>O pagamento será feito na {fulfillmentType === "entrega" ? "entrega" : "retirada"}. Acompanhe abaixo cada etapa do preparo.</p>
            <a className={styles.track} href={`/pedido/${order.tracking_token}`}>Acompanhar meu pedido</a>
            <button className={styles.secondary} onClick={close}>Continuar no site</button>
          </div>
        ) : (
          <form className={styles.body} onSubmit={confirm}>
            <p className={styles.sectionLabel}>COMO VOCÊ QUER RECEBER?</p>
            <div className={styles.tipoGrid}>
              <button type="button" className={`${styles.tipoCard} ${fulfillmentType === "entrega" ? styles.tipoActive : ""}`} onClick={() => setFulfillmentType("entrega")}>
                <Icon.Bike width={26} height={26} /><strong>Entrega</strong><span>Receba no endereço informado</span>
              </button>
              <button type="button" className={`${styles.tipoCard} ${fulfillmentType === "retirada" ? styles.tipoActive : ""}`} onClick={() => setFulfillmentType("retirada")}>
                <Icon.Store width={26} height={26} /><strong>Retirada</strong><span>Busque no balcão</span>
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}><label><Icon.User width={14} height={14} /> SEU NOME</label><input name="name" type="text" autoComplete="name" required /></div>
              <div className={styles.field}><label><Icon.Phone width={14} height={14} /> TELEFONE / WHATSAPP</label><input name="phone" type="tel" autoComplete="tel" placeholder="(51) 9 9999-9999" required /></div>
            </div>

            {fulfillmentType === "entrega" && (
              <>
                <div className={styles.row}>
                  <div className={styles.field} style={{ flex: 2 }}><label><Icon.Pin width={14} height={14} /> RUA</label><input name="street" autoComplete="address-line1" required /></div>
                  <div className={styles.field}><label>NÚMERO</label><input name="number" required /></div>
                </div>
                <div className={styles.row}>
                  <div className={styles.field}><label>BAIRRO</label><input name="neighborhood" autoComplete="address-level3" required /></div>
                  <div className={styles.field}><label>COMPLEMENTO</label><input name="complement" autoComplete="address-line2" /></div>
                </div>
                <div className={styles.field}><label>REFERÊNCIA</label><input name="reference" /></div>
              </>
            )}

            <div className={styles.field}><label>OBSERVAÇÕES DO PEDIDO</label><input name="notes" placeholder="Ex.: tocar a campainha" /></div>

            <p className={styles.sectionLabel}>PAGAMENTO NA {fulfillmentType === "entrega" ? "ENTREGA" : "RETIRADA"}</p>
            <p className={styles.pgtoHint}>Nenhuma cobrança será feita pelo site.</p>
            <div className={styles.pgtoGrid}>
              {payments.map((payment) => {
                const PaymentIcon = Icon[payment.icon];
                return (
                  <button key={payment.id} type="button" className={`${styles.pgtoCard} ${paymentMethod === payment.id ? styles.pgtoActive : ""}`} onClick={() => setPaymentMethod(payment.id)}>
                    <span className={styles.pgtoIcon}><PaymentIcon width={20} height={20} /></span>
                    <span className={styles.pgtoText}><strong>{payment.label}</strong><em>{payment.sub}</em></span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === "dinheiro" && <div className={styles.field}><label>TROCO PARA (OPCIONAL)</label><input name="changeFor" inputMode="decimal" placeholder="Ex.: 100,00" /></div>}
            <div className={styles.summary}><span>{hasVariablePrice ? "Subtotal conhecido" : "Subtotal do carrinho"}</span><strong>{brl(total)}</strong><small>{hasVariablePrice ? "Produtos pesados terão o valor informado pela equipe após a pesagem. " : ""}A taxa de entrega, quando aplicável, será calculada pelo sistema.</small></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.confirm} disabled={busy || items.length === 0}>{busy ? "Enviando pedido..." : "Enviar pedido"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

