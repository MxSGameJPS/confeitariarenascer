"use client";

import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import { categorias } from "../data/produtos";
import styles from "./Menu.module.css";

const brl = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Menu() {
  const { addItem } = useCart();

  return (
    <div className={styles.wrap}>
      {categorias.map((cat) => {
        const CatIcon = Icon[cat.icon] || Icon.Cake;
        return (
          <div key={cat.id} className={styles.catBlock}>
            <div className={`${styles.catHead} reveal`}>
              <span className={styles.catIcon}>
                <CatIcon width={22} height={22} />
              </span>
              <div>
                <h3>{cat.nome}</h3>
                <p>{cat.desc}</p>
              </div>
            </div>

            <div className={styles.grid}>
              {cat.produtos.map((p, i) => (
                <article
                  key={p.id}
                  className={`${styles.card} reveal-scale`}
                  style={{ transitionDelay: `${i * 0.06}s` }}
                >
                  <div className={styles.imgWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.img} alt={p.nome} loading="lazy" />
                  </div>
                  <div className={styles.body}>
                    <h4>{p.nome}</h4>
                    <p>{p.desc}</p>
                    <div className={styles.foot}>
                      <span className={styles.preco}>{brl(p.preco)}</span>
                      <button
                        className={styles.add}
                        onClick={() =>
                          addItem({
                            id: p.id,
                            nome: p.nome,
                            preco: p.preco,
                            img: p.img,
                          })
                        }
                        aria-label={`Adicionar ${p.nome} ao carrinho`}
                      >
                        <Icon.Plus width={18} height={18} />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}