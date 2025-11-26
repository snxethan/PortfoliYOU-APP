import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';
import { X, RotateCcw } from 'lucide-react';

export default function PageSettingsModal({
    title = "Page settings",
    initialName = "",
    initialStarter = false,
    initialBackgroundColor = null,
    themeBackground,
    onCancel,
    onSave,
    onDelete,
}: {
    title?: string;
    initialName?: string;
    initialStarter?: boolean;
    initialBackgroundColor?: string | null;
    themeBackground?: string | null;
    onCancel: () => void;
    onSave: (opts: { name: string; starter: boolean; backgroundColor: string | null }) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(initialName || "");
    const [starter, setStarter] = useState<boolean>(Boolean(initialStarter));
    const [background, setBackground] = useState<string>((initialBackgroundColor || '').trim());

    useEffect(() => {
        setName(initialName || "");
    }, [initialName]);
    useEffect(() => { setStarter(Boolean(initialStarter)); }, [initialStarter]);
    useEffect(() => {
        setBackground((initialBackgroundColor || '').trim());
    }, [initialBackgroundColor]);
    const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const fallbackTheme = useMemo(() => {
        const raw = (themeBackground || '').trim();
        return HEX_COLOR_RE.test(raw) ? raw : '#ffffff';
    }, [themeBackground]);
    const backgroundSwatch = useMemo(() => {
        const raw = background.trim();
        if (HEX_COLOR_RE.test(raw)) return raw;
        return fallbackTheme;
    }, [background, fallbackTheme]);

    const modal = (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
            tabIndex={-1}
        >
            <div
                className="surface w-full max-w-lg border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-auto scrollable scrollable-container"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] modal-header-sticky">
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Configure page metadata and appearance</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onCancel} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-4">
                    <form onSubmit={(e) => { e.preventDefault(); const v = name.trim(); if (v) onSave({ name: v, starter, backgroundColor: background.trim() ? background.trim() : null }); }}>
                        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Page</div>
                                <div className="text-xs text-[color:var(--fg-muted)]">Details</div>
                            </div>
                            <label className="text-sm text-[color:var(--fg-muted)]">Name</label>
                            <input
                                className="input w-full mb-3"
                                placeholder="Page name"
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />

                            <label className="text-sm text-[color:var(--fg-muted)]">Background</label>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="color"
                                    className="w-12 h-12 rounded border border-[color:var(--border)] bg-[color:var(--surface)]"
                                    value={backgroundSwatch}
                                    onChange={(e) => setBackground(e.target.value)}
                                    aria-label="Page background color"
                                />
                                <input
                                    className="input flex-1"
                                    placeholder={themeBackground || '#ffffff'}
                                    value={background}
                                    onChange={(e) => setBackground(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    title="Reset to theme"
                                    aria-label="Reset page background to theme"
                                    onClick={() => setBackground('')}
                                >
                                    <RotateCcw size={14} />
                                </button>
                            </div>
                            <p className="text-[12px] text-[color:var(--fg-muted)] mb-3">Leave blank to inherit the active theme background.</p>

                            <div className="flex items-center gap-3 mb-3">
                                <input id="starter-toggle" type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
                                <label htmlFor="starter-toggle" className="text-sm">Default page</label>
                            </div>

                        </section>

                        <div className="flex justify-end items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-error btn-xs"
                                title="Delete page"
                                aria-label="Delete page"
                                onClick={() => { if (confirm('Delete this page? This cannot be undone.')) onDelete(); }}
                            >
                                {/* Trash icon-only button */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                            </button>
                            <button type="submit" className="btn btn-accent btn-xs" disabled={!name.trim()}>Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    try {
        return createPortal(modal, document.body);
    } catch {
        // Fallback: render inline if portal unavailable (e.g., during SSR)
        return modal;
    }
}
