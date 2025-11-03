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
    return (
        <section className="surface p-5">
            <div className="grid grid-cols-3 items-center gap-3">
                {/* Left: notification button and website button */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleNotifications}
                        className={`btn btn-ghost relative w-10 h-10 p-0 ${notificationsOpen ? 'border-[color:var(--accent-600)]' : ''}`}
                        aria-label="Notifications"
                        title="Notifications"
                    >
                        {notifBadge > 0 ? <BellDot size={18} /> : <Bell size={18} />}
                        {notifBadge > 0 && (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">{notifBadge}</span>
                        )}
                    </button>
                    <a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/changelog" target="_blank" rel="noreferrer">Changelog</a>
                </div>
                {/* Center: icon + tagline */}
                <div className="text-center">
                    <div className="flex flex-col items-center w-full">
                        {/* App icon from public folder (prefer PNG, fallback to SVG) */}
                        <img
                            src="/icon.png"
                            onError={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = '/icon.svg'; } }}
                            alt="Portfoli-YOU icon"
                            className="w-50 h-30 rounded-md  mb-1 object-cover"
                        />
                        <h2 className="text-xl font-semibold tracking-wide uppercase">Portfoli-YOU</h2>
                        <p className="text-sm text-[color:var(--fg-muted)]">A portfolio for you, by you</p>
                        {/* CTA moved to sidebar Account info popup when not signed in */}
                    </div>
                </div>
                {/* Right: website & FAQs */}
                <div className="flex items-center justify-end gap-2 text-sm">
                    <a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev" target="_blank" rel="noreferrer">Website</a>
                    <a className="btn btn-ghost px-2 py-1" href="https://portfoliyou.snxethan.dev/faq" target="_blank" rel="noreferrer">FAQs</a>
                </div>
            </div>
        </section>
    );
}
