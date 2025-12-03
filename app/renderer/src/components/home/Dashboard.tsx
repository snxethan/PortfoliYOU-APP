import React from "react";
import { Bell, BellDot } from "lucide-react";

export default function Dashboard({
    onToggleNotifications,
    notifBadge,
    notificationsOpen,
}: {
    onToggleNotifications: () => void;
    notifBadge: number;
    notificationsOpen: boolean;
}) {
    const badge = notifBadge > 0 ? notifBadge : null;
    return (
        <section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                        <img
                            src="/icon.png"
                            onError={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = '/icon.svg'; } }}
                            alt="Portfoli-YOU icon"
                            className="w-20 h-20 rounded-xl border border-[color:var(--border)] object-cover"
                        />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)] mb-1">portfoliyou.snxethan.dev</p>
                        <h1 className="section-title text-2xl tracking-tight">Portfoli-YOU</h1>
                        <p className="text-sm text-[color:var(--fg-muted)]">A Portfolio for you, by you.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-start lg:justify-end text-sm">
                    <a className="btn btn-ghost btn-sm" href="https://portfoliyou.snxethan.dev" target="_blank" rel="noreferrer">Website</a>
                    <a className="btn btn-ghost btn-sm" href="https://portfoliyou.snxethan.dev/about" target="_blank" rel="noreferrer">FAQs</a>
                    <a className="btn btn-ghost btn-sm" href="https://portfoliyou.snxethan.dev/changelog" target="_blank" rel="noreferrer">Changelog</a>
                </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[color:var(--border)] pt-4">
                <div className="text-sm text-[color:var(--fg-muted)]">Stay on top of announcements, updates, and account alerts.</div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleNotifications}
                        className={`btn btn-ghost relative w-11 h-11 p-0 ${notificationsOpen ? 'hover-accent border-[color:var(--accent)]' : ''}`}
                        aria-label="Notifications"
                        title="Notifications"
                        aria-pressed={notificationsOpen}
                    >
                        {badge ? <BellDot size={18} /> : <Bell size={18} />}
                        {badge && (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">{badge}</span>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
