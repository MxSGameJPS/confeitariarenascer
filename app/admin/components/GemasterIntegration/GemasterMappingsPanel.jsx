"use client";

import { useEffect, useMemo, useState } from "react";
import { bridgeAdminRequest } from "./bridge-admin-api";
import styles from "./GemasterIntegration.module.css";

function getGlobalMapping(product) {
  return product.gemasterMappings?.find((mapping) => !mapping.organization_id && !mapping.store_id) || product.gemasterMappings?.[0] || null;
}

function ProductMappingRow({ product, onSaved }) {
  const current = getGlobalMapping(product);
  const [externalCode, setExternalCode] = useState(current?.external_code || "");
  const [externalEan, setExternalEan] = useState(current?.external_ean || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await bridgeAdminRequest("/api/admin/gemaster-mappings", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          externalCode,
          externalEan: externalEan || null,
        }),
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const mapped = Boolean(current?.external_code);

  return (
    <article className={styles.mappingRow}>
      <div className={styles.productInfo}>
        <div>
          <strong>{product.name}</strong>
          <span data-mapped={mapped}>{mapped ? "Mapeado" : "Pendente"}</span>
        </div>
        <small>{product.pricing_mode === "variable" ? "Produto por peso" : `Unidade: ${product.unit || "un"}`}</small>
      </div>

      <label>
        Código no GeMaster
        <input value={externalCode} onChange={(event) => setExternalCode(event.target.value)} placeholder="Ex.: 154" maxLength={64} />
      </label>

      <label>
        EAN no GeMaster (opcional)
        <input value={externalEan} onChange={(event) => setExternalEan(event.target.value.replace(/\D/g, ""))} placeholder="789..." maxLength={32} inputMode="numeric" />
      </label>

      <div className={styles.mappingAction}>
        <button type="button" onClick={save} disabled={saving || !externalCode.trim()}>{saving ? "Salvando..." : "Salvar"}</button>
        {error && <small className={styles.inlineError}>{error}</small>}
      </div>
    </article>
  );
}

export default function GemasterMappingsPanel() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMappings() {
    setLoading(true);
    setError("");
    try {
      const data = await bridgeAdminRequest("/api/admin/gemaster-mappings");
      setProducts(data?.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMappings();
  }, []);

  const mappedCount = useMemo(() => products.filter((product) => Boolean(getGlobalMapping(product)?.external_code)).length, [products]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const mapping = getGlobalMapping(product);
      const mapped = Boolean(mapping?.external_code);
      if (status === "mapped" && !mapped) return false;
      if (status === "pending" && mapped) return false;
      if (!normalized) return true;
      return [product.name, mapping?.external_code, mapping?.external_ean]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [products, query, status]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>CATÁLOGO EXTERNO</span>
          <h2>Produtos Renascer ↔ GeMaster</h2>
          <p>O Bridge só envia itens que possuam um código GeMaster conhecido. Isso evita lançar produto errado no caixa.</p>
        </div>
        <div className={styles.counter}><strong>{mappedCount}</strong><span>de {products.length} mapeados</span></div>
      </div>

      <div className={styles.csvNotice}>
        <div>
          <strong>Importação do CSV GeMaster</strong>
          <p>Esta tela está pronta para receber o importador em massa. Vamos habilitá-lo depois de validar o arquivo real exportado na padaria, sem adivinhar nomes de colunas.</p>
        </div>
        <span>Aguardando CSV real</span>
      </div>

      <div className={styles.filters}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, código ou EAN" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="mapped">Mapeados</option>
        </select>
        <button type="button" className={styles.secondaryButton} onClick={loadMappings} disabled={loading}>Atualizar</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading ? (
        <p className={styles.muted}>Carregando produtos...</p>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>Nenhum produto encontrado para este filtro.</div>
      ) : (
        <div className={styles.mappingList}>
          {filtered.map((product) => <ProductMappingRow key={product.id} product={product} onSaved={loadMappings} />)}
        </div>
      )}
    </section>
  );
}
