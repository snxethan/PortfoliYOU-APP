import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, AlertOctagon, ArrowUpCircle } from "lucide-react";

import { useNotifications } from "../providers/NotificationsProvider";

function typeIcon(type: string) {
  switch (type) {
    case 'success': return <CheckCircle2 size={16} className="text-emerald-400"/>;
    case 'warn':
    case 'warning':
      return <AlertTriangle size={16} className="text-yellow-400"/>;
    case 'error': return <XCircle size={16} className="text-red-400"/>;
    case 'critical': return <AlertOctagon size={16} className="text-red-500"/>;
    case 'update': return <ArrowUpCircle size={16} className="text-sky-400"/>;
    default: return <Info size={16} className="text-sky-400"/>;
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

  // Auto-hide toasts after a short duration without removing them from storage.
  useEffect(() => {
    for (const n of notifications) {
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
      if (!notifications.find(n => n.id === id)) {
        window.clearTimeout(timers.current[id]);
        delete timers.current[id];
      }
    }
  }, [notifications, hidden]);

  const visible = useMemo(() => notifications.filter(n => !hidden[n.id]), [notifications, hidden]);
  if (!visible.length) return null;
  return (
    <div className="fixed bottom-2 right-2 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {visible.map(n => {
        const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
          if (n.href) {
            return (
              <a href={n.href} target="_blank" rel="noreferrer" className="no-underline">
                {children}
              </a>
            );
          }
          return <>{children}</>;
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
                    <a href={n.href} target="_blank" rel="noreferrer" className="text-xs link-accent">
                      {n.ctaLabel || 'Open link'}
                    </a>
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

export default function NotificationsUI() {
  return <NotificationStack />;
}
