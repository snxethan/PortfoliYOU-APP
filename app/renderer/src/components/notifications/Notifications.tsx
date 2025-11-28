import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, AlertOctagon, ArrowUpCircle } from "lucide-react";

import { useNotifications } from "../../providers/NotificationsProvider";

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
      if (timers.current[n.id]) continue; // timer already set
      const t = window.setTimeout(() => {
        setHidden(prev => ({ ...prev, [n.id]: true }));
        window.clearTimeout(timers.current[n.id]);
        delete timers.current[n.id];
      }, 6000);
      timers.current[n.id] = t;
    }
    // Clean up timers for removed notifications
    for (const id of Object.keys(timers.current)) {
      if (!toastable.find(n => n.id === id)) {
        window.clearTimeout(timers.current[id]);
        delete timers.current[id];
      }
    }
  }, [notifications, hidden]);

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
                  try {
                    // prefer openPath -> opens folder or file
                    if ((window as any).api?.openPath) {
                      await (window as any).api.openPath({ path: n.href.replace(/^file:\/\//, '') });
                    } else if ((window as any).api?.showItemInFolder) {
                      await (window as any).api.showItemInFolder({ filePath: n.href.replace(/^file:\/\//, '') });
                    } else {
                      // fallback: try anchor navigation
                      window.open(n.href, '_blank');
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
          <div key={n.id} className={`surface py-fade-in border ${typeClasses(n.type)} pointer-events-auto shadow-lg`}>
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
                      const isLocalPath = typeof n.href === 'string' && (n.href.startsWith('file://') || /^[a-zA-Z]:\\/.test(n.href) || n.href.startsWith('\\') || n.href.startsWith('/'));
                      if (isLocalPath) {
                        return (
                          <button
                            type="button"
                            className="text-xs link-accent"
                            onClick={async (e) => {
                              try {
                                if ((window as any).api?.openPath) {
                                  await (window as any).api.openPath({ path: n.href.replace(/^file:\/\//, '') });
                                } else if ((window as any).api?.showItemInFolder) {
                                  await (window as any).api.showItemInFolder({ filePath: n.href.replace(/^file:\/\//, '') });
                                } else {
                                  window.open(n.href, '_blank');
                                }
                              } catch { /* ignore */ }
                            }}
                          >
                            {n.ctaLabel || 'Open'}
                          </button>
                        );
                      }
                      return (
                        <a href={n.href} target="_blank" rel="noreferrer" className="text-xs link-accent">
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

function usePortalContainer(id = 'py-toast-root') {
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
    el.style.zIndex = '40000';
    el.style.pointerEvents = 'none';
    rootRef.current = el;
  }
  // keep stable ref
  return rootRef;
}

export default function NotificationsUI() {
  const rootRef = usePortalContainer();
  if (!rootRef.current) return null;
  return createPortal(<NotificationStack />, rootRef.current);
}
