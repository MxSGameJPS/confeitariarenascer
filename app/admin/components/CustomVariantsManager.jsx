"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./CustomVariantsManager.module.css";

export default function CustomVariantsManager({ product, onClose }) {
  const [variants, setVariants] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/products/${product.id}/subprodutos`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "Não foi possível carregar subprodutos.");
    setVariants(json.data || []);
  }, [product.id]);
  useEffect(() => { load().catch((err) => setError(err.message)); }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}/subprodutos`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Erro ao cadastrar.");
      setName("");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function update(entry, payload) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}/subprodutos`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: entry.id, ...payload }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Não foi possível atualizar.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return (
    <section className={styles.panel} aria-label="Gerenciar subprodutos">
      <div className={styles.heading}>
        <div><strong>Subprodutos de {product.name}</strong><p>Sem preço cadastrado. O atendente informa o valor da venda. Não é obrigatório escolher um subproduto.</p></div>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <form onSubmit={save} className={styles.form}>
        <input value={name} required maxLength={100} minLength={2}
          placeholder="Ex.: Coca Lata, Fanta Lata, Coca 2 Litros"
          onChange={(event) => setName(event.target.value)} aria-label="Novo subproduto" />
        <button disabled={busy || name.trim().length < 2}>Adicionar</button>
      </form>
      {variants.length === 0 && <p>Nenhum subproduto cadastrado. A venda continua liberada normalmente.</p>}
      <ul className={styles.items}>
        {variants.map((entry) => <li key={entry.id}>
          <span>{entry.name} {!entry.active && "(arquivado)"}</span>
          <div>
            <button disabled={busy} type="button" onClick={() => {
              const next = window.prompt("Nome do subproduto", entry.name);
              if (next && next.trim() !== entry.name) update(entry, { name: next.trim() });
            }}>Renomear</button>
            <button disabled={busy} type="button" onClick={() => update(entry, { active: !entry.active })}>
              {entry.active ? "Arquivar" : "Reativar"}
            </button>
          </div>
        </li>)}
      </ul>
    </section>
  );
}
