"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToSupabaseBroadcast } from "@/src/shared/realtime/supabase-broadcast";
import styles from "./CommandTableOverview.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function commandState(sale) {
  if (sale.status === "concluido") return { label: "Paga", tone: "paid" };
  if (sale.status === "cancelado") return { label: "Cancelada", tone: "canceled" };

  const pending = (sale.requests ?? []).some((request) => request.status === "pendente");
  if (pending) return { label: "Aguardando aprovação", tone: "pending" };
  if (sale.accepted_at) return { label: "Aberta", tone: "open" };
  return { label: "Aguardando pedido", tone: "waiting" };
}

function visitState(visit) {
  if (visit?.status === "ocupado") return { label: "Ocupada", tone: "occupied" };
  if (visit?.status === "aberto") return { label: "Aguardando aprovação", tone: "waiting" };
  return { label: "Em atendimento", tone: "occupied" };
}

export default function CommandTableOverview({ surface = "staff" }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sales?channel=comanda", {
        headers: { "x-renascer-surface": surface },
        cache: "no-store",
      });
      const body = await response.json();
      if (response.ok) setSales(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [surface]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToSupabaseBroadcast({
      channel: "renascer:comanda",
      onChange: () => {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(load, 120);
      },
    });

    return () => {
      unsubscribe();
      window.clearTimeout(refreshTimer.current);
    };
  }, [load]);

  const tables = useMemo(() => {
    const groups = new Map();

    for (const sale of sales) {
      if (!sale.table) continue;

      const visitStatus = sale.visit?.status ?? (sale.status === "aberto" ? "ocupado" : "encerrado");
      if (visitStatus === "encerrado") continue;

      const key = sale.table_visit_id ?? `legacy-${sale.table.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          table: sale.table,
          visit: sale.visit ?? null,
          commands: [],
        });
      }
      groups.get(key).commands.push(sale);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        commands: group.commands.sort((a, b) => Number(a.order_number) - Number(b.order_number)),
      }))
      .sort((a, b) => Number(a.table.table_number) - Number(b.table.table_number));
  }, [sales]);

  if (loading) {
    return <section className={styles.overview}><p className={styles.empty}>Carregando ocupação das mesas...</p></section>;
  }

  return (
    <section className={styles.overview}>
      <div className={styles.title}>
        <div>
          <span>MESAS EM ATENDIMENTO</span>
          <h2>Comandas por mesa</h2>
        </div>
        <button type="button" onClick={load}>Atualizar</button>
      </div>

      {tables.length === 0 && (
        <p className={styles.empty}>Nenhuma mesa possui atendimento ativo neste momento.</p>
      )}

      <div className={styles.grid}>
        {tables.map((group) => {
          const state = visitState(group.visit);
          const total = group.commands.reduce((sum, command) => sum + Number(command.total || 0), 0);
          const openCount = group.commands.filter((command) => command.status === "aberto").length;

          return (
            <article key={group.id} className={styles.tableCard}>
              <header>
                <div>
                  <span>MESA</span>
                  <strong>{group.table.table_number}</strong>
                </div>
                <div className={styles.visitStatus} data-tone={state.tone}>
                  {state.label}
                </div>
              </header>

              <div className={styles.summary}>
                <span>{group.commands.length} comanda(s)</span>
                <span>{openCount} aberta(s)</span>
                <strong>{money.format(total)}</strong>
              </div>

              <ul>
                {group.commands.map((command) => {
                  const status = commandState(command);
                  return (
                    <li key={command.id}>
                      <div>
                        <strong>Comanda {command.order_number}</strong>
                        <span>{command.command_label || "Cliente da mesa"}</span>
                      </div>
                      <div className={styles.commandMeta}>
                        <b>{money.format(Number(command.total || 0))}</b>
                        <span data-tone={status.tone}>{status.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <footer>
                <small>
                  {group.visit?.opened_at
                    ? `Atendimento iniciado ${new Date(group.visit.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Atendimento ativo"}
                </small>
                <span>A mesa só será liberada após a última comanda.</span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
