"use client";

import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import styles from "./CartDrawer.module.css";

const brl = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CartDrawer() {
  const { items, total, open, setOpen, changeQtd, removeItem, setCheckout } =
    useCart();

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.show : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`${styles.drawer} ${open ? styles.open : ""}`}>
        <header className={styles.head}>
          <span className={styles.title}>
            <Icon.Cart width={20} height={20} /> Seu carrinho
          </span>
          <button
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Fechar carrinho"
          >
            <Icon.Close width={20} height={20} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <Icon.Cart width={48} height={48} />
            <p>Seu carrinho está vazio</p>
            <span>Adicione produtos do nosso cardápio.</span>
          </div>
        ) : (
          <>
            <div className={styles.list}>
              {items.map((it) => (
                <div key={it.id} className={styles.item}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.img} alt={it.nome} />
                  <div className={styles.info}>
                    <strong>{it.nome}</strong>
                    <span>{brl(it.preco)}</span>
                    <div className={styles.qtd}>
                      <button onClick={() => changeQtd(it.id, -1)} aria-label="Menos">
                        <Icon.Minus width={14} height={14} />
                      </button>
                      <span>{it.qtd}</span>
                      <button onClick={() => changeQtd(it.id, 1)} aria-label="Mais">
                        <Icon.Plus width={14} height={14} />
                      </button>
                    </div>
                  </div>
                  <button
                    className={styles.remove}
                    onClick={() => removeItem(it.id)}
                    aria-label="Remover"
                  >
                    <Icon.Trash width={18} height={18} />
                  </button>
                </div>
              ))}
            </div>

            <footer className={styles.foot}>
              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>{brl(total)}</strong>
              </div>
              <button
                className={styles.finish}
                onClick={() => {
                  setOpen(false);
                  setCheckout(true);
                }}
              >
                Finalizar pedido
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}