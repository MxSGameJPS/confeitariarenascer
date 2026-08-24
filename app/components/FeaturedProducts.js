"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import styles from "../page.module.css";

export default function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/products?featured=true", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!active) return;
        if (!ok) throw new Error("FEATURED_UNAVAILABLE");
        setProducts(body.data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <section id="destaques" className={styles.destaques}>
        <p className={styles.featuredState}>Carregando os favoritos...</p>
      </section>
    );
  }

  if (status === "error" || products.length === 0) {
    return null;
  }

  return (
    <section id="destaques" className={styles.destaques}>
      <div className={`${styles.sectionHead} reveal`}>
        <span className={styles.sectionTagLight}>Os queridinhos</span>
        <h2>Os favoritos da casa</h2>
      </div>
      <div className={styles.destGrid}>
        {products.map((product, index) => (
          <article
            key={product.id}
            className={`${styles.destCard} reveal`}
            style={{ transitionDelay: `${index * 0.1}s` }}
          >
            <div className={styles.destImg}>
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.name} loading="lazy" />
              ) : (
                <span className={styles.destPlaceholder} aria-hidden="true">
                  <Icon.Bread width={38} height={38} />
                </span>
              )}
              <span className={styles.destIcon}>
                <Icon.Cake width={22} height={22} />
              </span>
            </div>
            <div className={styles.destBody}>
              <h3>{product.name}</h3>
              {product.description && <p>{product.description}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

