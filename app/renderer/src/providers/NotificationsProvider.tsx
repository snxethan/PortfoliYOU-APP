import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

function loadStored(): NotificationItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveStored(list: NotificationItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export type NotificationsCtx = {
  notifications: NotificationItem[];
  add: (n: Omit<NotificationItem, "id" | "createdAt"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
};

const Ctx = createContext<NotificationsCtx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>(() => loadStored());
  const saveRef = useRef(items);
  useEffect(() => { saveRef.current = items; saveStored(items); }, [items]);

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

  const api = useMemo<NotificationsCtx>(() => ({ notifications: items, add, dismiss, clearAll }), [items, add, dismiss, clearAll]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const v = useContext(Ctx); if (!v) throw new Error("useNotifications outside provider"); return v;
}
