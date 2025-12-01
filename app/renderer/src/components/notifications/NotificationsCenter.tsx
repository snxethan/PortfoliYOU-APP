import React from "react";
import { CalendarDays, Clock, Info, X } from "lucide-react";

import type { NotificationItem, NotificationType } from "../../providers/NotificationsProvider";

type FilterKey = "all" | NotificationType;

const SEVERITY_META: Record<NotificationType, { label: string; badge: string; pill: string }> = {
    critical: { label: "Critical", badge: "bg-red-500/90 text-black", pill: "text-red-300" },
    error: { label: "Error", badge: "bg-red-400 text-black", pill: "text-red-300" },
    warning: { label: "Warning", badge: "bg-yellow-400 text-black", pill: "text-yellow-300" },
    warn: { label: "Warning", badge: "bg-yellow-400 text-black", pill: "text-yellow-300" },
    update: { label: "Update", badge: "bg-sky-400 text-black", pill: "text-sky-300" },
    success: { label: "Success", badge: "bg-emerald-400 text-black", pill: "text-emerald-300" },
    info: { label: "Info", badge: "bg-[color:var(--accent)] text-black", pill: "text-[color:var(--accent)]" },
};

function normalizeType(type: NotificationType): NotificationType {
    return type === 'warn' ? 'warning' : type;
}

function formatDayLabel(date: Date) {
    const now = new Date();
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeLabel(date: Date) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function SeverityBadge({ type }: { type: NotificationType }) {
    const meta = SEVERITY_META[normalizeType(type)];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.badge}`}>
            {meta.label}
        </span>
    );
}

export default function NotificationsCenter({
    notifications,
    onDismiss,
    onClearAll,
}: {
    notifications: NotificationItem[];
    onDismiss: (id: string) => void;
    onClearAll: () => void;
}) {
    const [filter, setFilter] = React.useState<FilterKey>('all');

    const normalized = React.useMemo(() => (
        notifications
            .map((n) => {
                const date = new Date(n.createdAt);
                const typeNormalized = normalizeType(n.type) as NotificationType;
                return { ...n, createdDate: date, typeNormalized, dayKey: date.toISOString().slice(0, 10) };
            })
            .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
    ), [notifications]);

    const severityCounts = React.useMemo(() => {
        const counts: Record<NotificationType, number> = {
            info: 0, success: 0, warning: 0, warn: 0, error: 0, critical: 0, update: 0,
        };
        for (const n of normalized) {
            counts[n.typeNormalized] = (counts[n.typeNormalized] || 0) + 1;
        }
        return counts;
    }, [normalized]);

    const filtered = React.useMemo(() => {
        if (filter === 'all') return normalized;
        return normalized.filter(n => n.typeNormalized === filter);
    }, [normalized, filter]);

    const dayGroups = React.useMemo(() => {
        const map = new Map<string, { key: string; label: string; timestamp: number; items: typeof filtered }>();
        for (const n of filtered) {
            const existing = map.get(n.dayKey);
            if (existing) {
                existing.items.push(n);
                existing.timestamp = Math.max(existing.timestamp, n.createdDate.getTime());
            } else {
                map.set(n.dayKey, { key: n.dayKey, label: formatDayLabel(n.createdDate), timestamp: n.createdDate.getTime(), items: [n] });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [filtered]);

    const filterOptions: FilterKey[] = ['all', 'critical', 'error', 'warning', 'update', 'success', 'info'];
    const lastUpdated = normalized[0]?.createdDate;

    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-5 h-[26rem] max-h-[26rem] overflow-hidden">
            <aside className="md:w-60 w-full border-b md:border-b-0 md:border-r border-[color:var(--border)] pr-2 md:pr-4 pb-3 md:pb-0 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
                <div>
                    <p className="section-title">NOTIFICATION DASHBOARD</p>
                    <p className="text-3xl font-semibold leading-tight">{notifications.length}</p>
                    <p className="text-xs text-[color:var(--fg-muted)]">Stored notifications</p>
                </div>
                <div className="text-xs text-[color:var(--fg-muted)] flex items-center gap-2">
                    <Clock size={12} />
                    {lastUpdated ? `Last update ${formatDayLabel(lastUpdated)} • ${formatTimeLabel(lastUpdated)}` : 'Waiting for activity'}
                </div>
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)] flex items-center gap-1">
                        <Info size={12} /> Filter by type
                    </p>
                    <div className="">
                        {filterOptions.map((key) => {
                            const isActive = filter === key;
                            const label = key === 'all' ? 'All' : SEVERITY_META[key === 'warn' ? 'warning' : key as NotificationType].label;
                            const count = key === 'all' ? normalized.length : severityCounts[key === 'warn' ? 'warning' : key as NotificationType] || 0;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`w-full flex items-center justify-between rounded-md px-2 py-1 text-sm transition ${isActive ? 'bg-[color:var(--muted)]/80 text-[color:var(--fg)]' : 'text-[color:var(--fg-muted)] hover:bg-[color:var(--muted)]/40'}`}
                                    onClick={() => setFilter(key)}
                                >
                                    <span>{label}</span>
                                    <span className="text-xs">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                    <button className="btn btn-outline btn-sm" onClick={onClearAll} disabled={!notifications.length}>Clear all</button>
                </div>
            </aside>
            <div className="flex-1 h-full min-w-0">
                <div className="h-full overflow-y-auto pr-1 space-y-4">
                    {filtered.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-[color:var(--fg-muted)]">
                            No notifications to show.
                        </div>
                    ) : dayGroups.map((group) => (
                        <div key={group.key} className="space-y-2">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">
                                <CalendarDays size={12} />
                                {group.label}
                            </div>
                            <div className="space-y-2">
                                {group.items.map((item) => (
                                    <div key={item.id} className="border border-[color:var(--border)] rounded-xl p-3 bg-[color:var(--muted)]/15">
                                        <div className="flex items-start gap-3">
                                            <SeverityBadge type={item.typeNormalized} />
                                            <div className="min-w-0 flex-1">
                                                {item.title ? <div className="text-sm font-semibold">{item.title}</div> : null}
                                                <div className="text-sm whitespace-pre-wrap break-words">{item.message}</div>
                                                <div className="mt-1 text-xs text-[color:var(--fg-muted)] flex flex-wrap items-center gap-3">
                                                    <span>{formatTimeLabel(item.createdDate)}</span>
                                                    <span>{item.persistent ? 'Persistent' : 'Transient'}</span>
                                                    {item.count && item.count > 1 ? <span>{item.count}×</span> : null}
                                                    {item.href ? (
                                                        <a
                                                            className="text-xs link-accent"
                                                            href={item.href}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            {item.ctaLabel || 'Open link'}
                                                        </a>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <button className="btn btn-ghost btn-xs" onClick={() => onDismiss(item.id)} aria-label="Dismiss notification">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
