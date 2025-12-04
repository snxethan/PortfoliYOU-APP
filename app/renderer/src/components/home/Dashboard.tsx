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
        <section className="surface border border-[color:var(--border)] rounded-2xl shadow-lg shadow-black/20 portfolio-workspace-card" style={{ animation: 'py-pop 0.4s ease-out' }}>
            <div className="portfolio-workspace-card__header">
                <div className="portfolio-workspace-card__identity">
                    <div className="portfolio-workspace-card__logo-block relative">
                        <img
                            src="./icon.png"
                            onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                if (!img.dataset.fallback) {
                                    img.dataset.fallback = '1';
                                    img.src = './icon.svg';
                                }
                            }}
                            alt="Portfoli-YOU icon"
                            className="portfolio-workspace-card__logo rounded-xl border border-[color:var(--border)] object-cover"
                        />
                    </div>
                    <div className="portfolio-workspace-card__text">
                        <a
                            href="https://portfoliyou.snxethan.dev"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs uppercase tracking-[0.2em] text-[color:var(--fg-muted)] mb-1 inline-block cursor-pointer hover:text-[color:var(--accent)] transition-colors"
                            title="Visit portfoliyou.snxethan.dev"
                        >
                            portfoliyou.snxethan.dev
                        </a>
                        <h1 className="section-title text-2xl tracking-tight">Portfoli-YOU</h1>
                        <p className="text-sm text-[color:var(--fg-muted)]">A Portfolio for you, by you.</p>
                    </div>
                </div>
                <div className="portfolio-workspace-card__tabs">
                    <a className="portfolio-workspace-card__tab btn btn-ghost btn-sm hover:bg-[color:var(--muted)] hover:border-[color:var(--border)] transition-colors" href="https://portfoliyou.snxethan.dev" target="_blank" rel="noreferrer">Website</a>
                    <a className="portfolio-workspace-card__tab btn btn-ghost btn-sm hover:bg-[color:var(--muted)] hover:border-[color:var(--border)] transition-colors" href="https://portfoliyou.snxethan.dev/about" target="_blank" rel="noreferrer">FAQs</a>
                    <a className="portfolio-workspace-card__tab btn btn-ghost btn-sm hover:bg-[color:var(--muted)] hover:border-[color:var(--border)] transition-colors" href="https://portfoliyou.snxethan.dev/changelog" target="_blank" rel="noreferrer">Changelog</a>
                </div>
            </div>
            <div className="portfolio-workspace-card__cta">
                <div className="portfolio-workspace-card__desc">Stay on top of announcements, updates, and account alerts.</div>
                <div className="portfolio-workspace-card__bell">
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
