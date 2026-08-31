"use client";

import { useState } from "react";
import BridgeDevicesPanel from "./BridgeDevicesPanel";
import GemasterMappingsPanel from "./GemasterMappingsPanel";
import styles from "./GemasterIntegration.module.css";

export default function GemasterIntegration() {
  const [tab, setTab] = useState("devices");

  return (
    <div className={styles.wrapper}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>INTEGRAÇÕES</span>
          <h1>GeMaster</h1>
          <p>Gerencie os computadores autorizados e o vínculo entre os produtos do Renascer e os códigos usados no GeMaster.</p>
        </div>
        <div className={styles.safetyBadge}>Bridge não confirma pagamento</div>
      </header>

      <div className={styles.flowCard}>
        <span>Renascer</span><b>→</b><span>Bridge Windows</span><b>→</b><span>GeMaster</span>
      </div>

      <nav className={styles.tabs} aria-label="Seções da integração GeMaster">
        <button type="button" className={tab === "devices" ? styles.activeTab : ""} onClick={() => setTab("devices")}>Dispositivos Bridge</button>
        <button type="button" className={tab === "mappings" ? styles.activeTab : ""} onClick={() => setTab("mappings")}>Mapeamento de produtos</button>
      </nav>

      {tab === "devices" ? <BridgeDevicesPanel /> : <GemasterMappingsPanel />}
    </div>
  );
}
