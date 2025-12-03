import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export type NotificationType =
  | "info"
  | "success"
  | "warning" // preferred spelling
  | "warn"    // alias (back-compat)
  | "error"
  | "critical"
  | "update";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  href?: string; // optional link to open (e.g., changelog)
  ctaLabel?: string; // optional CTA label
  createdAt: string; // ISO
  persistent: boolean; // true => stays until dismissed
  count?: number; // dedupe counter
  bootstrap?: boolean; // true when restored from storage on launch
};

export type NotifyEventDetail = {
  type?: NotificationType;
  message: string;
  title?: string;
  persistent?: boolean;
  href?: string;
  ctaLabel?: string;
};

const STORAGE_KEY = "py.notifications";

type StoredNotification = Omit<NotificationItem, "bootstrap">;
const REMOTE_FEED_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> })?.env?.VITE_NOTIFICATIONS_FEED_URL) as string | undefined;

function loadStored(): NotificationItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as StoredNotification[];
    if (!Array.isArray(stored)) return [];
    return stored.map(item => ({ ...item, bootstrap: true }));
  } catch { return []; }
}
function saveStored(list: NotificationItem[]) {
  const filtered = list.filter((item) => item.persistent || item.bootstrap);
  const serialized: StoredNotification[] = filtered.map(item => {
    const { bootstrap, ...rest } = item;
    void bootstrap;
    return rest;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}

export type NotificationsCtx = {
  notifications: NotificationItem[];
  add: (n: Omit<NotificationItem, "id" | "createdAt"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
  panelOpen: boolean;
  panelPulse: boolean;
  openPanel: (opts?: { highlight?: boolean }) => void;
  closePanel: () => void;
  togglePanel: (opts?: { highlight?: boolean }) => void;
};

const Ctx = createContext<NotificationsCtx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>(() => loadStored());
  const saveRef = useRef(items);
  useEffect(() => { saveRef.current = items; saveStored(items); }, [items]);
  const location = useLocation();

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelPulse, setPanelPulse] = useState(false);
  const pulseTimerRef = useRef<number | null>(null);

  const clearPulseTimer = useCallback(() => {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
  }, []);

  const triggerPanelPulse = useCallback(() => {
    setPanelPulse(true);
    clearPulseTimer();
    pulseTimerRef.current = window.setTimeout(() => {
      setPanelPulse(false);
      pulseTimerRef.current = null;
    }, 1400);
  }, [clearPulseTimer]);

  const openPanel = useCallback((opts?: { highlight?: boolean }) => {
    setPanelOpen(true);
    if (opts?.highlight !== false) triggerPanelPulse();
  }, [triggerPanelPulse]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const togglePanel = useCallback((opts?: { highlight?: boolean }) => {
    setPanelOpen(prev => {
      const next = !prev;
      if (next && opts?.highlight !== false) triggerPanelPulse();
      return next;
    });
  }, [triggerPanelPulse]);

  const add = useCallback((n: Omit<NotificationItem, "id" | "createdAt"> & { id?: string }) => {
    const id = n.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const persistent = n.persistent ?? true; // default to persistent
    // Normalize type aliases
    const typeNorm: NotificationType = (n.type === 'warn' ? 'warning' : n.type) as NotificationType;

    // Dedupe recent identical notifications by bumping count
    const prev = saveRef.current;
    if (prev.length > 0) {
      const last = prev[0];
      if (last.type === typeNorm && last.message === n.message && last.persistent === persistent) {
        const bumped = { ...last, count: (last.count || 1) + 1, createdAt: now } as NotificationItem;
        const next = [bumped, ...prev.slice(1)];
        setItems(next);
        return id;
      }
    }

    const item: NotificationItem = {
      id,
      type: (typeNorm || "info") as NotificationType,
      message: n.message,
      title: n.title,
      href: n.href,
      ctaLabel: n.ctaLabel,
      persistent,
      createdAt: now,
      bootstrap: false,
    };
    setItems((curr) => [item, ...curr].slice(0, 50));

    // If app is not focused, request taskbar/dock flash for notable notifications
    try {
      const shouldFlash = (persistent || item.type === 'error' || item.type === 'warning' || item.type === 'critical' || item.type === 'update');
      const notFocused = typeof document !== 'undefined' && !document.hasFocus();
      if (shouldFlash && notFocused && window.api?.flashFrame) {
        void window.api.flashFrame({ durationMs: 6000 });
      }
    } catch { /* ignore */ }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((curr) => curr.filter(x => x.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  // Bridge: listen to window events dispatched across the app
  useEffect(() => {
    function onNotify(evt: Event) {
      const e = evt as CustomEvent<NotifyEventDetail>;
      const d = e.detail || { message: "", type: "info" };
      if (!d.message) return;
      add({ type: d.type || "info", message: d.message, title: d.title, href: d.href, ctaLabel: d.ctaLabel, persistent: d.persistent ?? true });
    }
    window.addEventListener("py:notify", onNotify as EventListener);
    return () => window.removeEventListener("py:notify", onNotify as EventListener);
  }, [add]);

  // Allow the shell (or backend bridge) to push notifications via IPC.
  useEffect(() => {
    const off = window.api?.onWindowEvent?.("notifications:push", (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as Partial<NotifyEventDetail> & { message?: string };
      if (!data.message) return;
      add({
        type: data.type || "info",
        message: data.message,
        title: data.title,
        href: data.href,
        ctaLabel: data.ctaLabel,
        persistent: data.persistent ?? true,
      });
    });
    return () => { if (typeof off === 'function') off(); };
  }, [add]);

  // Optional SSE feed so backend services can stream notifications without IPC.
  useEffect(() => {
    if (!REMOTE_FEED_URL) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let stopped = false;

    const scheduleReconnect = () => {
      if (retryTimer !== null || stopped) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, 5000);
    };

    const connect = () => {
      if (stopped) return;
      try { source?.close(); } catch { /* ignore */ }
      try {
        source = new EventSource(REMOTE_FEED_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      if (!source) { scheduleReconnect(); return; }
      source.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data ?? '{}');
          if (!data || typeof data.message !== 'string' || !data.message.trim()) return;
          add({
            type: data.type || 'info',
            message: data.message,
            title: data.title,
            href: data.href,
            ctaLabel: data.ctaLabel,
            persistent: data.persistent ?? true,
          });
        } catch { /* ignore malformed payloads */ }
      };
      source.onerror = () => {
        try { source?.close(); } catch { /* ignore */ }
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      stopped = true;
      try { source?.close(); } catch { /* ignore */ }
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
  }, [add]);

  useEffect(() => () => clearPulseTimer(), [clearPulseTimer]);

  useEffect(() => {
    function handleToggle() {
      if (location.pathname === '/') return;
      togglePanel();
    }
    function handleHighlight() {
      if (location.pathname === '/') return;
      openPanel({ highlight: true });
    }
    window.addEventListener('py:toggle-notifications', handleToggle as EventListener);
    window.addEventListener('py:highlight-notifications', handleHighlight as EventListener);
    return () => {
      window.removeEventListener('py:toggle-notifications', handleToggle as EventListener);
      window.removeEventListener('py:highlight-notifications', handleHighlight as EventListener);
    };
  }, [location.pathname, openPanel, togglePanel]);

  const api = useMemo<NotificationsCtx>(() => ({
    notifications: items,
    add,
    dismiss,
    clearAll,
    panelOpen,
    panelPulse,
    openPanel,
    closePanel,
    togglePanel,
  }), [items, add, dismiss, clearAll, panelOpen, panelPulse, openPanel, closePanel, togglePanel]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const v = useContext(Ctx); if (!v) throw new Error("useNotifications outside provider"); return v;
}
