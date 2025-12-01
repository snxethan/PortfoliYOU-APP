import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, AlertOctagon, ArrowUpCircle } from "lucide-react";

import { useNotifications } from "../../providers/NotificationsProvider";
import NotificationsCenter from "./NotificationsCenter";

function typeIcon(type: string) {
  switch (type) {
    case 'success': return <CheckCircle2 size={16} className="text-emerald-400" />;
    case 'warn':
    case 'warning':
      return <AlertTriangle size={16} className="text-yellow-400" />;
    case 'error': return <XCircle size={16} className="text-red-400" />;
    case 'critical': return <AlertOctagon size={16} className="text-red-500" />;
    case 'update': return <ArrowUpCircle size={16} className="text-sky-400" />;
    default: return <Info size={16} className="text-sky-400" />;
  }
}

function typeClasses(type: string) {
  switch (type) {
    case 'success': return 'border-emerald-600/50';
    case 'warn':
    case 'warning':
      return 'border-yellow-600/50';
    case 'error': return 'border-red-600/50';
    case 'critical': return 'border-red-700/70';
    case 'update': return 'border-sky-600/60';
    default: return 'border-sky-600/50';
  }
}

export function NotificationStack() {
  const { notifications, dismiss } = useNotifications();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, number>>({});
  const summaryTimer = useRef<number | null>(null);
  const summaryShownRef = useRef(false);
  const [summary, setSummary] = useState<{ count: number; visible: boolean }>({ count: 0, visible: false });

  const clearHideTimer = useCallback((id: string) => {
    if (!timers.current[id]) return;
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const scheduleHide = useCallback((id: string, delay = 6000, force = false) => {
    if (!force && timers.current[id]) return;
    clearHideTimer(id);
    timers.current[id] = window.setTimeout(() => {
      setHidden(prev => ({ ...prev, [id]: true }));
      clearHideTimer(id);
    }, delay);
  }, [clearHideTimer]);

  const dismissSummary = useCallback(() => {
    setSummary(prev => (prev.visible ? { ...prev, visible: false } : prev));
    if (summaryTimer.current) {
      window.clearTimeout(summaryTimer.current);
      summaryTimer.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (summaryTimer.current) {
      window.clearTimeout(summaryTimer.current);
      summaryTimer.current = null;
    }
  }, []);

  // Auto-hide toasts after a short duration without removing them from storage.
  useEffect(() => {
    const toastable = notifications.filter(n => !n.bootstrap);
    for (const n of toastable) {
      if (hidden[n.id]) continue; // already hidden
      scheduleHide(n.id);
    }
    // Clean up timers for removed notifications
    for (const id of Object.keys(timers.current)) {
      if (!toastable.find(n => n.id === id)) {
        clearHideTimer(id);
      }
    }
  }, [notifications, hidden, scheduleHide, clearHideTimer]);

  const bootstrapCount = useMemo(() => notifications.filter(n => n.bootstrap).length, [notifications]);
  useEffect(() => {
    if (summaryShownRef.current) return;
    if (!bootstrapCount) return;
    summaryShownRef.current = true;
    setSummary({ count: bootstrapCount, visible: true });
    if (summaryTimer.current) window.clearTimeout(summaryTimer.current);
    summaryTimer.current = window.setTimeout(() => dismissSummary(), 6000);
  }, [bootstrapCount, dismissSummary]);

  const visible = useMemo(
    () => notifications.filter(n => !n.bootstrap && !hidden[n.id]),
    [notifications, hidden]
  );

  if (!visible.length && !summary.visible) return null;
  return (
    <div className="fixed bottom-2 right-2 z-[40000] flex flex-col gap-2 max-w-sm pointer-events-none">
      {summary.visible && summary.count > 0 ? (
        <div className="surface py-fade-in border border-[color:var(--primary)] pointer-events-auto shadow-lg">
          <div className="p-3 flex items-start gap-3">
            <div className="mt-0.5">
              <Info size={16} className="text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm mb-0.5">Unread notifications</div>
              <div className="text-sm whitespace-pre-wrap break-words">You have {summary.count} unread {summary.count === 1 ? 'notification' : 'notifications'}.</div>
            </div>
            <button className="btn btn-ghost btn-xs" aria-label="Dismiss unread summary" onClick={dismissSummary}>
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}
      {visible.map(n => {
        const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
          if (!n.href) return <>{children}</>;
          // If href looks like a local file path, open via native API rather than anchor.
          const isLocalPath = typeof n.href === 'string' && (n.href.startsWith('file://') || /^[a-zA-Z]:\\/.test(n.href) || n.href.startsWith('\\') || n.href.startsWith('/'));
          if (isLocalPath) {
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={async (e) => {
                  e.preventDefault();
                  const href = n.href;
                  if (!href) return;
                  try {
                    // prefer openPath -> opens folder or file
                    if ((window as any).api?.openPath) {
                      await (window as any).api.openPath({ path: href.replace(/^file:\/\//, '') });
                    } else if ((window as any).api?.showItemInFolder) {
                      await (window as any).api.showItemInFolder({ filePath: href.replace(/^file:\/\//, '') });
                    } else {
                      // fallback: try anchor navigation
                      window.open(href, '_blank');
                    }
                  } catch { /* ignore */ }
                }}
                className="cursor-pointer"
              >
                {children}
              </div>
            );
          }
          return (
            <a href={n.href} target="_blank" rel="noreferrer" className="no-underline">
              {children}
            </a>
          );
        };
        return (
          <div
            key={n.id}
            className={`surface py-fade-in border ${typeClasses(n.type)} pointer-events-auto shadow-lg`}
            onMouseEnter={() => clearHideTimer(n.id)}
            onMouseLeave={() => scheduleHide(n.id, 4000, true)}
          >
            <div className="p-3 flex items-start gap-3">
              <div className="mt-0.5">{typeIcon(n.type)}</div>
              <div className="min-w-0 flex-1">
                <Wrapper>
                  <div className="block">
                    {n.title ? <div className="font-semibold text-sm mb-0.5">{n.title}</div> : null}
                    <div className="text-sm whitespace-pre-wrap break-words">{n.message}</div>
                  </div>
                </Wrapper>
                {n.count && n.count > 1 ? (
                  <div className="mt-1 text-[11px] text-[color:var(--fg-muted)]">x{n.count} times</div>
                ) : null}
                {n.href ? (
                  <div className="mt-1">
                    {(() => {
                      const href = n.href;
                      const isLocalPath = typeof href === 'string' && (href.startsWith('file://') || /^[a-zA-Z]:\\/.test(href) || href.startsWith('\\') || href.startsWith('/'));
                      if (isLocalPath) {
                        return (
                          <button
                            type="button"
                            className="text-xs link-accent"
                            onClick={async (e) => {
                              try {
                                if ((window as any).api?.openPath) {
                                  await (window as any).api.openPath({ path: href.replace(/^file:\/\//, '') });
                                } else if ((window as any).api?.showItemInFolder) {
                                  await (window as any).api.showItemInFolder({ filePath: href.replace(/^file:\/\//, '') });
                                } else {
                                  window.open(href, '_blank');
                                }
                              } catch { /* ignore */ }
                            }}
                          >
                            {n.ctaLabel || 'Open'}
                          </button>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noreferrer" className="text-xs link-accent">
                          {n.ctaLabel || 'Open link'}
                        </a>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
              <button className="btn btn-ghost btn-xs" aria-label="Dismiss notification" onClick={() => dismiss(n.id)}>
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function usePortalContainer(id = 'py-toast-root', opts?: { pointerEvents?: 'auto' | 'none'; zIndex?: number }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  if (typeof document !== 'undefined' && !rootRef.current) {
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = String(opts?.zIndex ?? 40000);
    el.style.pointerEvents = opts?.pointerEvents ?? 'none';
    rootRef.current = el;
  }
  // keep stable ref
  return rootRef;
}

function NotificationsPanel() {
  const { notifications, dismiss, clearAll, panelOpen, closePanel, panelPulse } = useNotifications();
  const [visible, setVisible] = useState(panelOpen);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisible(panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closePanel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panelOpen, closePanel]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={closePanel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications center"
        className={`relative w-full max-w-5xl max-h-[90vh] surface border border-[color:var(--border)] rounded-2xl bg-[color:var(--surface)]/95 shadow-2xl overflow-hidden flex flex-col gap-3 ${panelPulse ? 'highlight-pulse' : ''}`}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Notifications Center</p>
          <button className="btn btn-ghost btn-sm" onClick={closePanel} aria-label="Close notifications center">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-hidden">
          <NotificationsCenter notifications={notifications} onDismiss={dismiss} onClearAll={clearAll} />
        </div>
      </div>
    </div>
  );
}

export default function NotificationsUI() {
  const { panelOpen } = useNotifications();
  const toastRoot = usePortalContainer('py-toast-root');
  const panelRoot = usePortalContainer('py-notifications-panel-root', { pointerEvents: 'none', zIndex: 45000 });
  useEffect(() => {
    const node = panelRoot.current;
    if (!node) return;
    node.style.pointerEvents = panelOpen ? 'auto' : 'none';
  }, [panelOpen, panelRoot]);
  return (
    <>
      {toastRoot.current ? createPortal(<NotificationStack />, toastRoot.current) : null}
      {panelRoot.current ? createPortal(<NotificationsPanel />, panelRoot.current) : null}
    </>
  );
}
