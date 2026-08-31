"use client";

import { useEffect, useState } from "react";
import { bridgeAdminRequest } from "./bridge-admin-api";
import styles from "./GemasterIntegration.module.css";

function formatDate(value) {
  if (!value) return "Nunca conectado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function BridgeDevicesPanel() {
  const [devices, setDevices] = useState([]);
  const [name, setName] = useState("Caixa 01");
  const [createdToken, setCreatedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDevices() {
    setLoading(true);
    setError("");
    try {
      setDevices((await bridgeAdminRequest("/api/admin/bridge-devices")) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function createDevice(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setCreatedToken("");
    try {
      const device = await bridgeAdminRequest("/api/admin/bridge-devices", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setCreatedToken(device.token);
      setName("");
      setMessage("Dispositivo criado. Copie o token agora: ele não será exibido novamente.");
      await loadDevices();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDevice(device) {
    setBusyId(device.id);
    setError("");
    setMessage("");
    try {
      await bridgeAdminRequest(`/api/admin/bridge-devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !device.active }),
      });
      setMessage(device.active ? "Acesso do Bridge revogado." : "Bridge reativado.");
      await loadDevices();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(createdToken);
      setMessage("Token copiado. Cole-o no Renascer Bridge do computador do caixa.");
    } catch {
      setMessage("Selecione e copie o token manualmente.");
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>COMPUTADORES AUTORIZADOS</span>
          <h2>Dispositivos Bridge</h2>
          <p>Cadastre cada computador de caixa individualmente. O token pode ser revogado sem afetar os demais caixas.</p>
        </div>
      </div>

      <form className={styles.deviceForm} onSubmit={createDevice}>
        <label>
          Nome do computador
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Caixa 01" required />
        </label>
        <button type="submit" disabled={saving}>{saving ? "Criando..." : "Cadastrar Bridge"}</button>
      </form>

      {createdToken && (
        <div className={styles.tokenBox}>
          <div>
            <strong>Token do novo Bridge</strong>
            <p>Guarde apenas no computador autorizado. O banco mantém somente o hash.</p>
          </div>
          <code>{createdToken}</code>
          <button type="button" onClick={copyToken}>Copiar token</button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.success}>{message}</div>}

      <div className={styles.listHeader}>
        <strong>Dispositivos cadastrados</strong>
        <button type="button" className={styles.secondaryButton} onClick={loadDevices} disabled={loading}>Atualizar</button>
      </div>

      {loading ? (
        <p className={styles.muted}>Carregando dispositivos...</p>
      ) : devices.length === 0 ? (
        <div className={styles.empty}>Nenhum Bridge cadastrado ainda.</div>
      ) : (
        <div className={styles.deviceList}>
          {devices.map((device) => (
            <article className={styles.deviceCard} key={device.id}>
              <div>
                <div className={styles.deviceTitle}>
                  <strong>{device.name}</strong>
                  <span data-active={device.active}>{device.active ? "Ativo" : "Revogado"}</span>
                </div>
                <small>Último contato: {formatDate(device.last_seen_at)}</small>
              </div>
              <button type="button" className={device.active ? styles.dangerButton : styles.secondaryButton} onClick={() => toggleDevice(device)} disabled={busyId === device.id}>
                {busyId === device.id ? "Salvando..." : device.active ? "Revogar" : "Reativar"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
