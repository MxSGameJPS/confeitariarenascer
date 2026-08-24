"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import styles from "./Menu.module.css";

const brl = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Menu() {
  const { addItem } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/products?channel=delivery", { cache: "no-store" }),
    ])
      .then(async ([categoriesResponse, productsResponse]) => {
        const [categoriesBody, productsBody] = await Promise.all([
          categoriesResponse.json(),
          productsResponse.json(),
        ]);

        if (!categoriesResponse.ok || !productsResponse.ok) {
          throw new Error("CATALOG_UNAVAILABLE");
        }

        if (active) {
          setCategories(categoriesBody.data ?? []);
          setProducts(productsBody.data ?? []);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const catalog = useMemo(
    () => categories
      .map((category) => ({
        ...category,
        products: products.filter((product) => product.category_id === category.id),
      }))
      .filter((category) => category.products.length > 0),
    [categories, products]
  );

  if (status === "loading") {
    return <div className={styles.catalogState}>Carregando o cardápio...</div>;
  }

  if (status === "error") {
    return (
      <div className={styles.catalogState}>
        <strong>O cardápio não pôde ser carregado.</strong>
        <span>Verifique sua conexão e tente novamente.</span>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setReloadKey((value) => value + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <div className={styles.catalogState}>
        <strong>Cardápio temporariamente indisponível.</strong>
        <span>Não há produtos ativos para pedidos neste momento.</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {catalog.map((category) => (
        <div key={category.id} className={styles.catBlock}>
          <div className={`${styles.catHead} reveal`}>
            <span className={styles.catIcon}>
              <Icon.Cake width={22} height={22} />
            </span>
            <div>
              <h3>{category.name}</h3>
              {category.description && <p>{category.description}</p>}
            </div>
          </div>

          <div className={styles.grid}>
            {category.products.map((product, index) => (
              <article
                key={product.id}
                className={`${styles.card} reveal-scale`}
                style={{ transitionDelay: `${index * 0.06}s` }}
              >
                <div className={styles.imgWrap}>
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} loading="lazy" />
                  ) : (
                    <span className={styles.imagePlaceholder} aria-hidden="true">
                      <Icon.Bread width={36} height={36} />
                    </span>
                  )}
                </div>
                <div className={styles.body}>
                  <h4>{product.name}</h4>
                  {product.description && <p>{product.description}</p>}
                  <div className={styles.foot}>
                    <span className={styles.preco}>
                      {product.pricing_mode === "variable"
                        ? "Valor após pesagem"
                        : brl(product.price)}
                    </span>
                    <button
                      className={styles.add}
                      onClick={() =>
                        addItem({
                          id: product.id,
                          nome: product.name,
                          preco: product.price,
                          img: product.image_url,
                          pricingMode: product.pricing_mode,
                        })
                      }
                      aria-label={`Adicionar ${product.name} ao carrinho`}
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
      ))}
    </div>
  );
}

