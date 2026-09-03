"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PwaInstallButton from "./PwaInstallButton";
import styles from "./WeighingApp.module.css";

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseWeight(value) {
  const normalized = String(value || "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export default function WeighingApp({ employee }) {
  const router = useRouter();
  const commandInputRef = useRef(null);
  const productInputRef = useRef(null);
  const weightInputRef = useRef(null);
  const pendingOperationRef = useRef(null);

  const [online, setOnline] = useState(true);
  const [commandNumber, setCommandNumber] = useState("");
  const [command, setCommand] = useState(null);
  const [productCode, setProductCode] = useState("");
  const [product, setProduct] = useState(null);
  const [weight, setWeight] = useState("");
  const [sessionItems, setSessionItems] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setOnline(navigator.onLine);

    function goOnline() {
      setOnline(true);
    }

    function goOffline() {
      setOnline(false);
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    commandInputRef.current?.focus();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const weightKg = useMemo(() => parseWeight(weight), [weight]);
  const estimatedTotal = useMemo(
    () => product && weightKg > 0
      ? roundCurrency(product.pricePerKg * weightKg)
      : 0,
    [product, weightKg],
  );
  const sessionTotal = useMemo(
    () => sessionItems.reduce((total, item) => total + Number(item.item_total || 0), 0),
    [sessionItems],
  );

  async function request(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.replace("/operacao/pesagem/login");
      router.refresh();
      throw new Error("Sessão expirada.");
    }

    if (!response.ok) {
      throw new Error(body?.error?.message || "Não foi possível concluir a operação.");
    }

    return body.data;
  }

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function resetProductStep() {
    setProductCode("");
    setProduct(null);
    setWeight("");
    pendingOperationRef.current = null;
  }

  function resetSession() {
    setCommandNumber("");
    setCommand(null);
    resetProductStep();
    setSessionItems([]);
    window.setTimeout(() => commandInputRef.current?.focus(), 0);
  }

  async function loadCommand(event) {
    event?.preventDefault();
    clearFeedback();

    const parsed = Number(commandNumber);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      setError("Digite o número da comanda.");
      return;
    }

    if (!online) {
      setError("Sem conexão. A comanda precisa ser validada antes da pesagem.");
      return;
    }

    try {
      setBusy("command");
      const result = await request(`/api/operacao/pesagem/comandas/${parsed}`);
      setCommand(result);
      setCommandNumber(String(result.order_number));
      resetProductStep();
      setMessage(`Comanda C${result.order_number} pronta para receber itens.`);
      window.setTimeout(() => productInputRef.current?.focus(), 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function loadProduct(event) {
    event?.preventDefault();
    clearFeedback();

    if (!command) {
      setError("Confirme a comanda primeiro.");
      return;
    }

    const code = productCode.trim();
    if (!code) {
      setError("Digite o código do produto.");
      return;
    }

    if (!online) {
      setError("Sem conexão. O produto precisa ser validado no sistema.");
      return;
    }

    try {
      setBusy("product");
      const result = await request(`/api/operacao/pesagem/produtos?code=${encodeURIComponent(code)}`);
      setProduct(result);
      setProductCode(result.code || code);
      setWeight("");
      pendingOperationRef.current = null;
      setMessage(`${result.name} localizado.`);
      window.setTimeout(() => weightInputRef.current?.focus(), 0);
    } catch (err) {
      setProduct(null);
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function addItem(mode) {
    clearFeedback();

    if (!command || !product) {
      setError("Confirme a comanda e o produto antes de inserir.");
      return;
    }

    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100) {
      setError("Informe um peso válido em kg.");
      return;
    }

    if (!online) {
      setError("Sem conexão. A pesagem ainda não foi adicionada à comanda.");
      return;
    }

    const signature = `${command.order_number}:${product.id}:${weightKg.toFixed(3)}`;
    let pending = pendingOperationRef.current;

    if (!pending || pending.signature !== signature) {
      pending = {
        signature,
        operationId: crypto.randomUUID(),
      };
      pendingOperationRef.current = pending;
    }

    try {
      setBusy("submit");
      const result = await request("/api/operacao/pesagem/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: command.order_number,
          productId: product.id,
          weightKg,
          operationId: pending.operationId,
        }),
      });

      pendingOperationRef.current = null;

      const inserted = {
        item_id: result.item_id,
        product_name: result.product_name || product.name,
        weight_kg: Number(result.weight_kg),
        price_per_kg: Number(result.price_per_kg),
        item_total: Number(result.item_total),
      };

      setCommand((current) => current ? { ...current, total: Number(result.order_total) } : current);
      setSessionItems((items) => (
        items.some((item) => item.item_id === inserted.item_id)
          ? items
          : [...items, inserted]
      ));

      if (mode === "continue") {
        const currentCommand = command.order_number;
        resetProductStep();
        setMessage(
          result.duplicate
            ? `Item já estava inserido na C${currentCommand}. Pode pesar o próximo.`
            : `${inserted.product_name} adicionado à C${currentCommand}. Pode pesar o próximo.`
        );
        window.setTimeout(() => productInputRef.current?.focus(), 0);
      } else {
        const currentCommand = command.order_number;
        const productName = inserted.product_name;
        resetSession();
        setMessage(
          result.duplicate
            ? `Item já estava inserido na C${currentCommand}. Pronto para a próxima comanda.`
            : `${productName} adicionado à C${currentCommand}. Pesagem finalizada.`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    try {
      await fetch("/api/staff/auth/logout", { method: "POST" });
    } finally {
      router.replace("/operacao/pesagem/login");
      router.refresh();
    }
  }

  const canSubmit = command
    && product
    && weightKg > 0
    && weightKg <= 100
    && !busy
    && online;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>⚖</span>
          <div>
            <strong>Renascer Pesagem</strong>
            <small>Estação de atendimento</small>
          </div>
        </div>

        <div className={styles.headerActions}>
          <span className={`${styles.connection} ${online ? styles.online : styles.offline}`}>
            <i />
            {online ? "Online" : "Sem conexão"}
          </span>
          <PwaInstallButton compact />
          <span className={styles.employee}>{employee.fullName}</span>
          <button type="button" className={styles.logout} onClick={logout}>Sair</button>
        </div>
      </header>

      {!online && (
        <div className={styles.offlineBanner}>
          <strong>Sem conexão</strong>
          <span>Nenhuma pesagem será confirmada até a internet voltar. Os dados digitados permanecem na tela.</span>
        </div>
      )}

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.workspace}>
        <div className={styles.flow}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <span>1</span>
              <div>
                <strong>Comanda</strong>
                <small>Digite somente o número. O prefixo C é automático.</small>
              </div>
            </div>

            {!command ? (
              <form className={styles.commandForm} onSubmit={loadCommand}>
                <label className={styles.commandInputWrap}>
                  <span>C</span>
                  <input
                    ref={commandInputRef}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={commandNumber}
                    onChange={(event) => {
                      setCommandNumber(event.target.value.replace(/\D/g, "").slice(0, 12));
                      clearFeedback();
                    }}
                    placeholder="105"
                    aria-label="Número da comanda"
                  />
                </label>
                <button type="submit" disabled={busy === "command" || !online}>
                  {busy === "command" ? "Validando..." : "Confirmar comanda"}
                </button>
              </form>
            ) : (
              <div className={styles.commandSelected}>
                <div>
                  <small>COMANDA ATUAL</small>
                  <strong>C{command.order_number}</strong>
                  <span>
                    {command.table?.table_number ? `Mesa ${command.table.table_number}` : "Atendimento de balcão"}
                    {" · "}
                    Total atual {brl(command.total)}
                  </span>
                </div>
                <button type="button" onClick={resetSession} disabled={Boolean(busy)}>
                  Trocar comanda
                </button>
              </div>
            )}
          </section>

          <section className={`${styles.card} ${!command ? styles.disabledCard : ""}`}>
            <div className={styles.cardTitle}>
              <span>2</span>
              <div>
                <strong>Produto</strong>
                <small>Use o código do produto cadastrado no GeMaster.</small>
              </div>
            </div>

            <form className={styles.productForm} onSubmit={loadProduct}>
              <input
                ref={productInputRef}
                disabled={!command || busy === "submit"}
                inputMode="numeric"
                autoComplete="off"
                value={productCode}
                onChange={(event) => {
                  setProductCode(event.target.value.trimStart().slice(0, 64));
                  setProduct(null);
                  setWeight("");
                  pendingOperationRef.current = null;
                  clearFeedback();
                }}
                placeholder="Código do produto"
                aria-label="Código do produto"
              />
              <button type="submit" disabled={!command || !productCode.trim() || busy === "product" || !online}>
                {busy === "product" ? "Buscando..." : "Buscar produto"}
              </button>
            </form>

            {product && (
              <div className={styles.productCard}>
                <div className={styles.productImage}>
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>Sem foto</span>}
                </div>
                <div>
                  <small>CÓDIGO {product.code}</small>
                  <strong>{product.name}</strong>
                  <span>{brl(product.pricePerKg)} / kg</span>
                  {product.reference && <em>Ref. {product.reference}</em>}
                </div>
              </div>
            )}
          </section>

          <section className={`${styles.card} ${!product ? styles.disabledCard : ""}`}>
            <div className={styles.cardTitle}>
              <span>3</span>
              <div>
                <strong>Peso e valor</strong>
                <small>Digite o peso mostrado na balança.</small>
              </div>
            </div>

            <div className={styles.weightGrid}>
              <label>
                Peso
                <div className={styles.weightInputWrap}>
                  <input
                    ref={weightInputRef}
                    disabled={!product || busy === "submit"}
                    inputMode="decimal"
                    autoComplete="off"
                    value={weight}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^0-9.,]/g, "").slice(0, 8);
                      setWeight(value);
                      pendingOperationRef.current = null;
                      clearFeedback();
                    }}
                    placeholder="0,350"
                    aria-label="Peso em quilogramas"
                  />
                  <span>kg</span>
                </div>
              </label>

              <div className={styles.totalBox}>
                <small>VALOR CALCULADO</small>
                <strong>{product && weightKg > 0 ? brl(estimatedTotal) : "R$ 0,00"}</strong>
                <span>
                  {product
                    ? `${weightKg > 0 ? weightKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : "0"} kg × ${brl(product.pricePerKg)}/kg`
                    : "Aguardando produto"}
                </span>
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button
                type="button"
                className={styles.continueButton}
                onClick={() => addItem("continue")}
                disabled={!canSubmit}
              >
                <strong>{busy === "submit" ? "Inserindo..." : "Adicionar e pesar outro"}</strong>
                <span>Mantém a mesma comanda</span>
              </button>

              <button
                type="button"
                className={styles.finishButton}
                onClick={() => addItem("finish")}
                disabled={!canSubmit}
              >
                <strong>{busy === "submit" ? "Inserindo..." : "Adicionar e finalizar"}</strong>
                <span>Volta para uma nova comanda</span>
              </button>
            </div>

            <p className={styles.finalizeHint}>
              “Finalizar” encerra somente esta sessão de pesagem. A comanda continua aberta para o caixa.
            </p>
          </section>
        </div>

        <aside className={styles.summary}>
          <div className={styles.summaryHead}>
            <div>
              <small>SESSÃO ATUAL</small>
              <strong>{command ? `Comanda C${command.order_number}` : "Nenhuma comanda"}</strong>
            </div>
            <span>{sessionItems.length} {sessionItems.length === 1 ? "item" : "itens"}</span>
          </div>

          <div className={styles.sessionItems}>
            {sessionItems.map((item) => (
              <article key={item.item_id}>
                <div>
                  <strong>{item.product_name}</strong>
                  <span>{Number(item.weight_kg).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</span>
                </div>
                <strong>{brl(item.item_total)}</strong>
              </article>
            ))}

            {sessionItems.length === 0 && (
              <div className={styles.emptySummary}>
                <span>⚖</span>
                <strong>Nenhum item nesta sessão</strong>
                <p>Os produtos confirmados com “pesar outro” aparecerão aqui para conferência.</p>
              </div>
            )}
          </div>

          <div className={styles.summaryTotals}>
            <div>
              <span>Total adicionado nesta sessão</span>
              <strong>{brl(sessionTotal)}</strong>
            </div>
            {command && (
              <div>
                <span>Total atual da comanda</span>
                <strong>{brl(command.total)}</strong>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
