"use client";

import { useEffect, useState } from "react";
import styles from "./DeliverySettings.module.css";
import areaStyles from "./DeliveryAreas.module.css";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const defaultHours = DAYS.map((_, day) => ({ day, enabled: day > 0, opens: "08:00", closes: "18:00" }));

export default function DeliverySettings() {
  const [settings, setSettings] = useState(null);
  const [area, setArea] = useState({ city: "", point: "", entireCity: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/store-settings").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível carregar as configurações.");
      const data = body.data;
      setSettings({ ...data, businessHours: data.businessHours?.length === 7 ? data.businessHours : defaultHours });
    }).catch((requestError) => setError(requestError.message));
  }, []);

  function change(name, value) { setSettings((current) => ({ ...current, [name]: value })); }
  function changeHour(day, name, value) {
    change("businessHours", settings.businessHours.map((entry) => entry.day === day ? { ...entry, [name]: value } : entry));
  }
  function addArea() {
    const city = area.city.trim();
    const point = area.entireCity ? null : area.point.trim();
    if (!city || (!area.entireCity && !point)) return;
    change("deliveryAreas", [...settings.deliveryAreas, { city, point, entireCity: area.entireCity }]);
    setArea({ city: "", point: "", entireCity: false });
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/store-settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível salvar.");
      setSettings(body.data); setMessage("Configurações do delivery salvas.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  if (!settings) return <p className={styles.loading}>{error || "Carregando configurações..."}</p>;

  return <form className={styles.wrap} onSubmit={save}>
    <header className={styles.header}>
      <div><span>OPERAÇÃO DO DELIVERY</span><h1>Configurações do delivery</h1><p>Defina o que o cliente verá e as regras usadas para aceitar cada pedido.</p></div>
      <label className={`${styles.status} ${settings.acceptsOrders ? styles.open : styles.closed}`}>
        <input type="checkbox" checked={settings.acceptsOrders} onChange={(event) => change("acceptsOrders", event.target.checked)} />
        <span>{settings.acceptsOrders ? "Recebendo pedidos" : "Delivery pausado"}</span>
      </label>
    </header>

    {message && <p className={styles.success}>{message}</p>}{error && <p className={styles.error}>{error}</p>}
    <section className={styles.panel}><div className={styles.panelHead}><h2>Valores e estimativas</h2><p>Esses dados aparecem no fechamento do pedido.</p></div>
      <div className={styles.grid}>
        <label>Taxa de entrega (R$)<input type="number" min="0" step="0.01" value={settings.deliveryFee} onChange={(e) => change("deliveryFee", e.target.value)} required /></label>
        <label>Pedido mínimo (R$)<input type="number" min="0" step="0.01" value={settings.minimumOrder} onChange={(e) => change("minimumOrder", e.target.value)} required /></label>
        <label>Entrega mínima (min)<input type="number" min="0" value={settings.deliveryEstimateMin} onChange={(e) => change("deliveryEstimateMin", Number(e.target.value))} required /></label>
        <label>Entrega máxima (min)<input type="number" min="0" value={settings.deliveryEstimateMax} onChange={(e) => change("deliveryEstimateMax", Number(e.target.value))} required /></label>
        <label>Retirada mínima (min)<input type="number" min="0" value={settings.pickupEstimateMin} onChange={(e) => change("pickupEstimateMin", Number(e.target.value))} required /></label>
        <label>Retirada máxima (min)<input type="number" min="0" value={settings.pickupEstimateMax} onChange={(e) => change("pickupEstimateMax", Number(e.target.value))} required /></label>
        <label className={styles.wide}>WhatsApp da loja<input value={settings.whatsapp || ""} onChange={(e) => change("whatsapp", e.target.value)} placeholder="(51) 99999-9999" /></label>
      </div>
    </section>

    <section className={styles.panel}><div className={styles.panelHead}><h2>Cidades e pontos atendidos</h2><p>Cadastre uma cidade inteira ou somente os bairros e pontos onde a entrega está disponível.</p></div>
      <div className={areaStyles.areaEntry}>
        <label>Cidade<input value={area.city} onChange={(e) => setArea((current) => ({ ...current, city: e.target.value }))} placeholder="Ex.: Novo Hamburgo" /></label>
        <label>Bairro ou ponto<input value={area.point} disabled={area.entireCity} onChange={(e) => setArea((current) => ({ ...current, point: e.target.value }))} placeholder="Ex.: Canudos" /></label>
        <label className={areaStyles.entireCity}><input type="checkbox" checked={area.entireCity} onChange={(e) => setArea((current) => ({ ...current, entireCity: e.target.checked, point: "" }))} />Atender toda a cidade</label>
        <button type="button" onClick={addArea}>Adicionar área</button>
      </div>
      <div className={areaStyles.areas}>{settings.deliveryAreas.map((item, index) => <article key={`${item.city}-${item.point || "all"}`}><div><strong>{item.city}</strong><span>{item.entireCity ? "Toda a cidade" : item.point}</span></div><button type="button" aria-label={`Remover ${item.city}`} onClick={() => change("deliveryAreas", settings.deliveryAreas.filter((_, itemIndex) => itemIndex !== index))}>Remover</button></article>)}</div>
    </section>

    <section className={styles.panel}><div className={styles.panelHead}><h2>Horários de atendimento</h2><p>Pedidos fora dos horários ativos serão recusados automaticamente.</p></div>
      <div className={styles.hours}>{settings.businessHours.map((entry) => <div className={styles.day} key={entry.day}>
        <label className={styles.dayToggle}><input type="checkbox" checked={entry.enabled} onChange={(e) => changeHour(entry.day, "enabled", e.target.checked)} /><strong>{DAYS[entry.day]}</strong></label>
        <label>Abre<input type="time" value={entry.opens} disabled={!entry.enabled} onChange={(e) => changeHour(entry.day, "opens", e.target.value)} /></label>
        <label>Fecha<input type="time" value={entry.closes} disabled={!entry.enabled} onChange={(e) => changeHour(entry.day, "closes", e.target.value)} /></label>
        <span>{entry.enabled ? "Ativo" : "Fechado"}</span>
      </div>)}</div>
    </section>
    <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar configurações"}</button></div>
  </form>;
}

