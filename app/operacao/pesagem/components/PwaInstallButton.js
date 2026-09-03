"use client";

import { useEffect, useState } from "react";
import styles from "./PwaInstallButton.module.css";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

export default function PwaInstallButton({ compact = false }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/operation-sw.js", { scope: "/operacao/pesagem" })
        .catch(() => {});
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setPromptEvent(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
  }

  if (installed) {
    return <span className={styles.installed}>✓ App instalado</span>;
  }

  if (promptEvent) {
    return (
      <button
        type="button"
        className={`${styles.installButton} ${compact ? styles.compact : ""}`}
        onClick={install}
      >
        Instalar Renascer Pesagem
      </button>
    );
  }

  return (
    <span className={`${styles.hint} ${compact ? styles.compactHint : ""}`}>
      No Android, use o menu do navegador e escolha “Instalar aplicativo”.
    </span>
  );
}
