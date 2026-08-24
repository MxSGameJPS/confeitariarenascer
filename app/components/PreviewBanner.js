"use client";

import { useState } from "react";
import { Icon } from "./Icons";
import styles from "./PreviewBanner.module.css";

export default function PreviewBanner() {
  const [show, setShow] = useState(true);
  if (!show) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.tag}>PRÉVIA</span>
      <p>
        Este é um <strong>site demonstrativo</strong> criado para a Padaria
        Renascer. Os preços e imagens são ilustrativos.
      </p>
      <button
        className={styles.close}
        onClick={() => setShow(false)}
        aria-label="Fechar aviso"
      >
        <Icon.Close width={16} height={16} />
      </button>
    </div>
  );
}