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
    const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
    // Group notifications by type+title+message
    const groups = React.useMemo(() => {
        const m = new Map<string, Array<typeof notifications[number]>>();
        for (const n of notifications) {
            const key = `${n.type}::${n.title || ''}::${n.message}`;
            const arr = m.get(key) || [];
            arr.push(n);
            m.set(key, arr);
        }
        return Array.from(m.entries()).map(([key, list]) => ({ key, list }));
    }, [notifications]);

    return (
        <div className="surface p-4 border border-[color:var(--accent)] rounded-2xl">
            <div className="mb-2">
                <div className="grid grid-cols-3 items-center">
                    <div />
                    <div className="text-sm font-semibold uppercase tracking-wide text-center">NOTIFICATIONS</div>
                    <div className="flex justify-end">
                        <button className="btn btn-outline btn-xs" onClick={onClearAll}>Clear all</button>
                    </div>
                </div>
            </div>
            <div className="mt-2 space-y-2">
                {notifications.length === 0 ? (
                    <div className="text-xs text-[color:var(--fg-muted)]">No notifications.</div>
                ) : groups.map(g => {
                    const first = g.list[0];
                    const expanded = !!openGroups[g.key];
                    return (
                        <div key={g.key} className="border border-[color:var(--border)] rounded-md" onClick={() => setOpenGroups(prev => ({ ...prev, [g.key]: !prev[g.key] }))}>
                            <div role="button" tabIndex={0} className="w-full flex items-center justify-between p-2 bg-[color:var(--muted)]/30" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenGroups(prev => ({ ...prev, [g.key]: !prev[g.key] })); } }} aria-expanded={expanded}>
                                <div className="flex items-center gap-2">
                                    <SeverityDot type={first.type as NotificationType} />
                                    <div className="text-sm font-medium truncate">{first.message}</div>
                                    {first.title ? <div className="text-xs text-[color:var(--fg-muted)] ml-2">{first.title}</div> : null}
                                </div>
                                <div className="text-xs text-[color:var(--fg-muted)]">{g.list.length > 1 ? `${g.list.length}×` : ''} {expanded ? '▾' : '▸'}</div>
                            </div>
                            {expanded ? (
                                <div className="p-2 space-y-1 bg-[color:var(--muted)]/20">
                                    {g.list.map(n => (
                                        <div key={n.id} className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs whitespace-pre-wrap break-words">{n.message}</div>
                                                <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{n.title ? `${n.title} • ` : ''}{new Date(n.createdAt).toLocaleString()}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }} title="Dismiss"><X size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-2 bg-[color:var(--muted)]/10 flex items-center justify-between">
                                    <div className="text-xs text-[color:var(--fg-muted)]">{first.title ? first.title : ''}</div>
                                    <div className="text-xs text-[color:var(--fg-muted)]">{new Date(first.createdAt).toLocaleString()}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
