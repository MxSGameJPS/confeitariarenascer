"use client";

import { useState } from "react";
import WeighingApp from "./WeighingApp";
import PhysicalCommands from "./PhysicalCommands";
import styles from "./WeighingTabs.module.css";

export default function WeighingTabs({ employee }) {
  const [tab, setTab] = useState("pesagem");
  return <>
    <nav className={styles.nav} aria-label="Áreas de pesagem">
      <button type="button" className={tab === "pesagem" ? styles.active : ""} onClick={() => setTab("pesagem")}>Pesagem</button>
      <button type="button" className={tab === "comandas" ? styles.active : ""} onClick={() => setTab("comandas")}>Comandas</button>
    </nav>
    <div hidden={tab !== "pesagem"}><WeighingApp employee={employee} /></div>
    {tab === "comandas" && <PhysicalCommands />}
  </>;
}
