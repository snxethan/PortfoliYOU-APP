import React from 'react';
import { Settings as SettingsIcon, Shield, HelpCircle, Trash2, X } from 'lucide-react';

export default function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;
    const openUrl = (url: string) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { void e; } };
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
        >
            <div className="surface p-5 w-full max-w-md border border-[color:var(--border)] rounded-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center mb-2 relative">
                    <button className="btn btn-ghost btn-xs absolute right-0 top-0" onClick={onClose} aria-label="Close"><X size={14} /></button>
                    <h4 className="text-base font-semibold">ACCOUNT SETTINGS</h4>
                </div>
                <div className="bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md p-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button className="btn btn-outline btn-sm" title="Manage account" onClick={() => openUrl('https://portfoliyou.snxethan.dev/account')}>
                            <SettingsIcon size={14} className="mr-1" /> Manage account
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Privacy & Security" onClick={() => openUrl('https://portfoliyou.snxethan.dev/privacy')}>
                            <Shield size={14} className="mr-1" /> Privacy & Security
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Account FAQs" onClick={() => openUrl('https://portfoliyou.snxethan.dev/about')}>
                            <HelpCircle size={14} className="mr-1" /> Account FAQs
                        </button>
                        <button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" title="Delete account" onClick={() => openUrl('https://portfoliyou.snxethan.dev/account/delete')}>
                            <Trash2 size={14} className="mr-1" /> Delete account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
