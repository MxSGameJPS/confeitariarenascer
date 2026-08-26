"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { subscribeToSupabaseBroadcast } from "@/src/shared/realtime/supabase-broadcast";
import styles from "./StaffShell.module.css";

const OperationNotificationsContext = createContext(null);
const CHANNELS = ["delivery", "comanda"];
const SOUND_STORAGE_KEY = "renascer.operationSound";

function pendingIds(channel, sales) {
  if (channel === "delivery") {
    return sales
      .filter((sale) => sale.status === "pendente")
      .map((sale) => sale.id);
  }

  return sales.flatMap((sale) =>
    (sale.requests ?? [])
      .filter((request) => request.status === "pendente")
      .map((request) => request.id)
  );
}

function notificationCopy(channel, count) {
  const plural = count > 1;
  if (channel === "delivery") {
    return {
      title: plural ? `${count} novos pedidos no Delivery` : "Novo pedido no Delivery",
      description: plural
        ? "Há novos pedidos aguardando aceite."
        : "Há um pedido aguardando aceite.",
      href: "/operacao/delivery",
      label: "Delivery",
    };
  }

  return {
    title: plural ? `${count} novos pedidos de Comanda` : "Novo pedido de Comanda",
    description: plural
      ? "Há solicitações de mesa aguardando atendimento."
      : "Há uma solicitação de mesa aguardando atendimento.",
    href: "/operacao/comandas",
    label: "Comandas",
  };
}

export function useOperationNotifications() {
  const context = useContext(OperationNotificationsContext);
  if (!context) {
    throw new Error("useOperationNotifications deve ser usado dentro do provider da operação.");
  }
  return context;
}

export function OperationNotificationsProvider({ children }) {
  const [counts, setCounts] = useState({ delivery: 0, comanda: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notice, setNotice] = useState(null);

  const soundEnabledRef = useRef(true);
  const audioRef = useRef({ delivery: null, comanda: null });
  const audioUnlockedRef = useRef(false);
  const knownPendingRef = useRef({ delivery: new Set(), comanda: new Set() });
  const initializedRef = useRef({ delivery: false, comanda: false });
  const requestSerialRef = useRef({ delivery: 0, comanda: 0 });
  const refreshTimersRef = useRef({ delivery: null, comanda: null });
  const noticeTimerRef = useRef(null);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) return;

    const audios = Object.values(audioRef.current).filter(Boolean);
    let unlocked = false;

    for (const audio of audios) {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        unlocked = true;
      } catch {
        audio.muted = false;
      }
    }

    audioUnlockedRef.current = unlocked;
  }, []);

  const playSound = useCallback((channel) => {
    if (!soundEnabledRef.current) return;
    const audio = audioRef.current[channel];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const showNotice = useCallback((channel, count) => {
    const copy = notificationCopy(channel, count);
    setNotice({ channel, count, ...copy });

    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 8000);
  }, []);

  const refreshChannel = useCallback(
    async (channel, { notify = true } = {}) => {
      const serial = ++requestSerialRef.current[channel];

      try {
        const response = await fetch(`/api/sales?channel=${channel}`, {
          headers: { "x-renascer-surface": "staff" },
          cache: "no-store",
        });
        const body = await response.json();

        if (!response.ok || serial !== requestSerialRef.current[channel]) return;

        const sales = body.data ?? [];
        const currentPending = pendingIds(channel, sales);
        const previousPending = knownPendingRef.current[channel];
        const wasInitialized = initializedRef.current[channel];
        const newPending = wasInitialized
          ? currentPending.filter((id) => !previousPending.has(id))
          : [];

        knownPendingRef.current[channel] = new Set(currentPending);
        initializedRef.current[channel] = true;
        setCounts((current) => ({ ...current, [channel]: currentPending.length }));

        if (notify && newPending.length > 0) {
          playSound(channel);
          showNotice(channel, newPending.length);
        }

        window.dispatchEvent(
          new CustomEvent("renascer:operation-refresh", {
            detail: { channel, sales },
          })
        );
      } catch {
        // O monitor continua ativo; o próximo Broadcast/poll tenta sincronizar novamente.
      }
    },
    [playSound, showNotice]
  );

  const scheduleRefresh = useCallback(
    (channel) => {
      window.clearTimeout(refreshTimersRef.current[channel]);
      refreshTimersRef.current[channel] = window.setTimeout(
        () => refreshChannel(channel, { notify: true }),
        120
      );
    },
    [refreshChannel]
  );

  useEffect(() => {
    const deliveryAudio = new Audio("/sounds/delivery.mp3");
    const commandAudio = new Audio("/sounds/comanda.mp3");
    deliveryAudio.preload = "auto";
    commandAudio.preload = "auto";
    audioRef.current = { delivery: deliveryAudio, comanda: commandAudio };

    const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);
    const legacy = window.localStorage.getItem("renascer.commandSound");
    const enabled = saved ? saved === "on" : legacy ? legacy === "on" : true;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);

    const handleInteraction = () => unlockAudio();
    window.addEventListener("pointerdown", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      deliveryAudio.pause();
      commandAudio.pause();
      audioRef.current = { delivery: null, comanda: null };
    };
  }, [unlockAudio]);

  useEffect(() => {
    refreshChannel("delivery", { notify: false });
    refreshChannel("comanda", { notify: false });

    const unsubscribers = CHANNELS.map((channel) =>
      subscribeToSupabaseBroadcast({
        channel: `renascer:${channel}`,
        onChange: () => scheduleRefresh(channel),
      })
    );

    const poll = window.setInterval(() => {
      refreshChannel("delivery", { notify: true });
      refreshChannel("comanda", { notify: true });
    }, 30000);

    const handleFocus = () => {
      refreshChannel("delivery", { notify: true });
      refreshChannel("comanda", { notify: true });
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      CHANNELS.forEach((channel) =>
        window.clearTimeout(refreshTimersRef.current[channel])
      );
      window.clearInterval(poll);
      window.clearTimeout(noticeTimerRef.current);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshChannel, scheduleRefresh]);

  const toggleSound = useCallback(() => {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");

    if (enabled) unlockAudio();
  }, [unlockAudio]);

  const value = useMemo(
    () => ({ counts, soundEnabled, toggleSound }),
    [counts, soundEnabled, toggleSound]
  );

  return (
    <OperationNotificationsContext.Provider value={value}>
      {children}

      {notice && (
        <div className={styles.operationToast} role="status" aria-live="assertive">
          <a className={styles.toastLink} href={notice.href}>
            <span className={styles.toastIcon}>!</span>
            <span className={styles.toastCopy}>
              <small>{notice.label}</small>
              <strong>{notice.title}</strong>
              <span>{notice.description}</span>
            </span>
          </a>
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setNotice(null)}
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      )}
    </OperationNotificationsContext.Provider>
  );
}
