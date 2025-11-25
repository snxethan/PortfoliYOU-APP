import React from 'react';
import { createPortal } from 'react-dom';
import { Settings as SettingsIcon, Shield, HelpCircle, Trash2, X } from 'lucide-react';

export default function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;
    const openUrl = (url: string) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { void e; } };
    const cards = [
        {
            title: 'Profile & billing',
            description: 'Update login details, billing info, and identities linked to Portfoli-YOU.',
            icon: SettingsIcon,
            cta: 'Manage account',
            action: () => openUrl('https://portfoliyou.snxethan.dev/account')
        },
        {
            title: 'Privacy & security',
            description: 'Review how we store your projects, configure data retention, and manage sessions.',
            icon: Shield,
            cta: 'Open privacy portal',
            action: () => openUrl('https://portfoliyou.snxethan.dev/privacy')
        },
        {
            title: 'Account FAQs',
            description: 'Find answers about syncing, quotas, billing, and troubleshooting sign-in issues.',
            icon: HelpCircle,
            cta: 'Visit help center',
            action: () => openUrl('https://portfoliyou.snxethan.dev/about')
        }
    ];

    const modal = (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="surface w-full max-w-lg border border-[color:var(--border)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] bg-[color:var(--muted)]/40">
                    <div className="flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
                        <SettingsIcon size={16} /> Account settings
                    </div>
                    <button className="btn btn-ghost btn-xxs" onClick={onClose} aria-label="Close"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-sm text-[color:var(--fg-muted)]">Manage your profile, security, and support resources without leaving the builder.</p>
                    <div className="grid grid-cols-1 gap-3">
                        {cards.map(card => (
                            <div key={card.title} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-4">
                                <div className="flex items-start gap-3">
                                    <card.icon size={18} className="text-[color:var(--accent)]" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold">{card.title}</p>
                                        <p className="text-xs text-[color:var(--fg-muted)]">{card.description}</p>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <button className="btn btn-ghost btn-sm w-full justify-center" onClick={card.action}>{card.cta}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
                            <Trash2 size={16} /> Delete account
                        </div>
                        <p className="text-xs text-red-200">Permanently remove your account data, sync history, and stored assets. This cannot be undone.</p>
                        <button className="btn btn-error btn-sm w-full" onClick={() => openUrl('https://portfoliyou.snxethan.dev/account/delete')}>
                            Delete my account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    try {
        return createPortal(modal, document.body);
    } catch {
        return modal;
    }
}
