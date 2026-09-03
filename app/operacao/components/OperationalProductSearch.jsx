"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OperationalProductSearch.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function productMeta(product) {
  const codes = [];
  if (product.reference) codes.push(`Ref. ${product.reference}`);
  if (product.gemaster_code) codes.push(`GeMaster ${product.gemaster_code}`);
  if (product.ean && product.ean !== product.reference) codes.push(`EAN ${product.ean}`);
  return codes.join(" · ");
}

export default function OperationalProductSearch({
  context,
  surface = "staff",
  onSelect,
  disabled = false,
  autoFocus = false,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  async function searchNow(value, { selectSingle = false } = {}) {
    const term = String(value || "").trim();
    window.clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!term) {
      setResults([]);
      setState("idle");
      setError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    setError("");

    try {
      const params = new URLSearchParams({ query: term, context });
      const response = await fetch(`/api/operacao/produtos?${params}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "x-renascer-surface": surface },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || "Não foi possível buscar o produto.");
      }

      const items = body.data ?? [];
      setResults(items);
      setState("ready");

      if (selectSingle && items.length === 1) {
        const accepted = await onSelect(items[0]);
        if (accepted !== false) {
          setQuery("");
          setResults([]);
          setState("idle");
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
    } catch (searchError) {
      if (searchError.name === "AbortError") return;
      setResults([]);
      setState("error");
      setError(searchError.message);
    }
  }

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  function changeQuery(value) {
    setQuery(value);
    setError("");
    window.clearTimeout(timerRef.current);

    const term = value.trim();
    if (!term) {
      abortRef.current?.abort();
      setResults([]);
      setState("idle");
      return;
    }

    timerRef.current = window.setTimeout(() => searchNow(term), 180);
  }

  async function choose(product) {
    const accepted = await onSelect(product);
    if (accepted === false) return;
    setQuery("");
    setResults([]);
    setState("idle");
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submit(event) {
    event.preventDefault();
    searchNow(query, { selectSingle: true });
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.searchForm} onSubmit={submit}>
        <label>
          <span>Localizar produto</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Referência, código GeMaster ou nome"
            autoComplete="off"
            disabled={disabled}
            autoFocus={autoFocus}
            aria-label="Buscar produto por referência, código GeMaster ou nome"
          />
        </label>
        <button type="submit" disabled={disabled || !query.trim() || state === "loading"}>
          {state === "loading" ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {state === "idle" && !query.trim() && (
        <p className={styles.hint}>
          Nenhum produto é carregado até você digitar. Ex.: <strong>77</strong>, <strong>51974</strong> ou <strong>pão</strong>.
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {state === "ready" && query.trim() && results.length === 0 && (
        <p className={styles.empty}>Nenhum produto encontrado para “{query.trim()}”.</p>
      )}

      {results.length > 0 && (
        <div className={styles.results} role="listbox" aria-label="Produtos encontrados">
          {results.map((product) => (
            <button
              type="button"
              key={product.id}
              className={styles.result}
              onClick={() => choose(product)}
              disabled={disabled}
            >
              <div>
                <strong>{product.name}</strong>
                <span>{productMeta(product) || "Produto Renascer"}</span>
              </div>
              <div className={styles.price}>
                <strong>{money.format(Number(product.price || 0))}</strong>
                <span>{product.pricing_mode === "variable" ? "/ kg" : "/ un"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
