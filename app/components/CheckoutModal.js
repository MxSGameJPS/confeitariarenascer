"use client";

import { useState } from "react";
import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import styles from "./CheckoutModal.module.css";

const brl = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pagamentos = [
  { id: "dinheiro", label: "Dinheiro", sub: "Levamos troco", icon: "Money" },
  { id: "pix", label: "Pix", sub: "QR Code na hora", icon: "Pix" },
  { id: "credito", label: "Cartão de crédito", sub: "Maquininha na entrega", icon: "Card" },
  { id: "debito", label: "Cartão de débito", sub: "Maquininha na entrega", icon: "Card" },
];

export default function CheckoutModal() {
  const { checkout, setCheckout, total, items, clear } = useCart();
  const [tipo, setTipo] = useState("entrega");
  const [pgto, setPgto] = useState("dinheiro");
  const [enviado, setEnviado] = useState(false);

  if (!checkout) return null;

  const fechar = () => {
    setCheckout(false);
    setEnviado(false);
  };

  const confirmar = (e) => {
    e.preventDefault();
    setEnviado(true);
  };

  return (
    <div className={styles.overlay} onClick={fechar}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className={styles.head}>
          <span className={styles.title}>
            <Icon.Receipt width={22} height={22} /> FINALIZAR PEDIDO
          </span>
          <button className={styles.close} onClick={fechar} aria-label="Fechar">
            <Icon.Close width={22} height={22} />
          </button>
        </header>

        {enviado ? (
          <div className={styles.sucesso}>
            <div className={styles.checkCircle}>
              <Icon.Whatsapp width={40} height={40} />
            </div>
            <h3>Pedido registrado!</h3>
            <p>
              Esta é uma <strong>prévia demonstrativa</strong>. Em um site real,
              seu pedido de <strong>{brl(total)}</strong> seria enviado
              automaticamente para o WhatsApp da padaria.
            </p>
            <button
              className={styles.confirm}
              onClick={() => {
                clear();
                fechar();
              }}
            >
              Entendi, fechar
            </button>
          </div>
        ) : (
          <form className={styles.body} onSubmit={confirmar}>
            <p className={styles.sectionLabel}>COMO VOCÊ QUER RECEBER?</p>
            <div className={styles.tipoGrid}>
              <button
                type="button"
                className={`${styles.tipoCard} ${tipo === "entrega" ? styles.tipoActive : ""}`}
                onClick={() => setTipo("entrega")}
              >
                <Icon.Bike width={26} height={26} />
                <strong>Entrega</strong>
                <span>35 a 45 min</span>
              </button>
              <button
                type="button"
                className={`${styles.tipoCard} ${tipo === "retirada" ? styles.tipoActive : ""}`}
                onClick={() => setTipo("retirada")}
              >
                <Icon.Store width={26} height={26} />
                <strong>Retirada</strong>
                <span>25 a 35 min</span>
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>
                  <Icon.User width={14} height={14} /> SEU NOME
                </label>
                <input type="text" placeholder="Maria da Silva" required />
              </div>
              <div className={styles.field}>
                <label>
                  <Icon.Phone width={14} height={14} /> TELEFONE / WHATSAPP
                </label>
                <input type="tel" placeholder="(51) 9 9999-9999" required />
              </div>
            </div>

            {tipo === "entrega" && (
              <>
                <div className={styles.row}>
                  <div className={styles.field} style={{ flex: 2 }}>
                    <label>
                      <Icon.Pin width={14} height={14} /> ENDEREÇO (RUA E NÚMERO)
                    </label>
                    <input type="text" placeholder="Rua das Palmeiras, 123" required />
                  </div>
                  <div className={styles.field}>
                    <label>BAIRRO</label>
                    <input type="text" placeholder="Centro" required />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>COMPLEMENTO / REFERÊNCIA (OPCIONAL)</label>
                  <input type="text" placeholder="Apto 42, bloco B, portão preto..." />
                </div>
              </>
            )}

            <p className={styles.sectionLabel}>PAGAMENTO NA ENTREGA</p>
            <p className={styles.pgtoHint}>
              Você paga quando receber o pedido ou buscar no balcão.
            </p>
            <div className={styles.pgtoGrid}>
              {pagamentos.map((p) => {
                const PgIcon = Icon[p.icon];
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.pgtoCard} ${pgto === p.id ? styles.pgtoActive : ""}`}
                    onClick={() => setPgto(p.id)}
                  >
                    <span className={styles.pgtoIcon}>
                      <PgIcon width={20} height={20} />
                    </span>
                    <span className={styles.pgtoText}>
                      <strong>{p.label}</strong>
                      <em>{p.sub}</em>
                    </span>
                  </button>
                );
              })}
            </div>

            <button type="submit" className={styles.confirm}>
              Confirmar pedido • {brl(total)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}