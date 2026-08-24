"use client";

import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import { Icon } from "./Icons";
import styles from "./Header.module.css";

const links = [
  { href: "#historia", label: "Nossa História" },
  { href: "#cardapio", label: "Cardápio" },
  { href: "#destaques", label: "Destaques" },
  { href: "#localizacao", label: "Onde Estamos" },
];

const WHATSAPP =
  "https://wa.me/5551000000000?text=Ol%C3%A1!%20Gostaria%20de%20fazer%20um%20pedido%20na%20Padaria%20Renascer.";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { count, setOpen: setCartOpen } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.solid : ""}`}>
      <a href="#topo" className={styles.brand}>
        <span className={styles.brandMark}>
          <Icon.Bread width={24} height={24} />
        </span>
        <span className={styles.brandText}>
          <strong>Renascer</strong>
          <em>Padaria & Confeitaria</em>
        </span>
      </a>

      <nav className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <a
          className={styles.cta}
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
        >
          Peça pelo WhatsApp
        </a>
      </nav>

      <div className={styles.actions}>
        <button
          className={styles.cartBtn}
          aria-label="Abrir carrinho"
          onClick={() => setCartOpen(true)}
        >
          <Icon.Cart width={22} height={22} />
          {count > 0 && <span className={styles.badge}>{count}</span>}
        </button>

        <button
          className={styles.burger}
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}