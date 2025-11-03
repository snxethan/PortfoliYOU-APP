import React from "react";
import { X } from "lucide-react";

import type { NotificationType } from "../../providers/NotificationsProvider";

function SeverityDot({ type }: { type: NotificationType }) {
    const norm = (type === 'warn' ? 'warning' : type);
    const cls = norm === 'success' ? 'bg-green-500'
        : norm === 'warning' ? 'bg-yellow-500'
            : norm === 'error' || norm === 'critical' ? 'bg-red-500'
                : norm === 'update' ? 'bg-sky-500'
                    : 'bg-[color:var(--primary)]';
    return <span className={`w-2 h-2 mt-1 rounded-full ${cls}`} />;
}

export default function NotificationsCenter({
    notifications,
    onDismiss,
    onClearAll,
}: {
    notifications: Array<{ id: string; type: NotificationType; title?: string; message: string; createdAt: number | string }>;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
}) {
    return (
        <div className="surface p-3 border border-[color:var(--accent)] rounded-md">
            <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide">Notifications</div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-outline btn-xs" onClick={onClearAll}>Clear all</button>
                </div>
            </div>
            <div className="mt-2 space-y-2">
                {notifications.length === 0 ? (
                    <div className="text-xs text-[color:var(--fg-muted)]">No notifications.</div>
                ) : notifications.map(n => (
                    <div key={n.id} className="flex items-start gap-3 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md p-2">
                        <SeverityDot type={n.type as NotificationType} />
                        <div className="min-w-0 flex-1">
                            {n.title ? <div className="text-xs font-semibold mb-0.5">{n.title}</div> : null}
                            <div className="text-xs whitespace-pre-wrap break-words">{n.message}</div>
                            <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                        <button className="btn btn-ghost btn-xs" onClick={() => onDismiss(n.id)} title="Dismiss"><X size={12} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}
