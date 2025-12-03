import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';
import { X, RotateCcw, ChevronDown, ChevronRight, Trash2, Copy } from 'lucide-react';

import { useScrollLock } from "../../hooks/useScrollLock";

export default function PageSettingsModal({
    title = "Page settings",
    initialName = "",
    initialStarter = false,
    initialBackgroundColor = null,
    themeBackground,
    onCancel,
    onSave,
    onDelete,
    onDuplicate,
}: {
    title?: string;
    initialName?: string;
    initialStarter?: boolean;
    initialBackgroundColor?: string | null;
    themeBackground?: string | null;
    onCancel: () => void;
    onSave: (opts: { name: string; starter: boolean; backgroundColor: string | null }) => void;
    onDelete: () => void;
    onDuplicate?: () => void;
}) {
    useScrollLock(true);

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

    function PageSettingsSections({ name, setName, starter, setStarter, background, setBackground, backgroundSwatch, themeBackground }: {
        name: string;
        setName: (s: string) => void;
        starter: boolean;
        setStarter: (v: boolean) => void;
        background: string;
        setBackground: (s: string) => void;
        backgroundSwatch: string;
        themeBackground?: string | null;
    }) {
        const [expanded, setExpanded] = useState<{ page: boolean; appearance: boolean }>({ page: true, appearance: true });
        const toggle = (k: 'page' | 'appearance') => setExpanded(prev => ({ ...prev, [k]: !prev[k] }));

        const renderSection = (key: 'page' | 'appearance', title: string, children?: React.ReactNode) => (
            <div className="border border-[color:var(--border)] rounded-md mb-3">
                <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-left" onClick={() => toggle(key)}>
                    <div className="flex items-center gap-2">
                        {expanded[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-semibold text-sm uppercase tracking-wide">{title}</span>
                    </div>
                </button>
                {expanded[key] && (
                    <div className="border-t border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 space-y-3 animate-[py-fade-in_0.2s_ease-out]">
                        {children}
                    </div>
                )}
            </div>
        );

        return (
            <div>
                {renderSection('page', 'Page', (
                    <>
                        <div className="grid grid-cols-3 gap-4 items-center mb-2">
                            <div className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Name</div>
                            <div className="col-span-2">
                                <input className="input w-full" placeholder="Page name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 items-center">
                            <div className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Default</div>
                            <div className="col-span-2 flex items-center gap-3">
                                <input id="starter-toggle" type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
                                <label htmlFor="starter-toggle" className="text-sm">Default page</label>
                            </div>
                        </div>
                    </>
                ))}

                {renderSection('appearance', 'Appearance', (
                    <>
                        <div className="grid grid-cols-3 gap-4 items-center mb-3">
                            <div className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Background</div>
                            <div className="col-span-2 flex items-center gap-2">
                                <input type="color" className="w-12 h-12 rounded border border-[color:var(--border)] bg-[color:var(--surface)]" value={backgroundSwatch} onChange={(e) => setBackground(e.target.value)} aria-label="Page background color" />
                                <input className="input flex-1" placeholder={themeBackground || '#ffffff'} value={background} onChange={(e) => setBackground(e.target.value)} />
                                <button type="button" className="btn btn-ghost btn-xs flex items-center gap-2" title="Reset to theme" aria-label="Reset page background to theme" onClick={() => setBackground('')}>
                                    <RotateCcw size={14} />
                                    <span className="text-xs">Reset</span>
                                </button>
                            </div>
                        </div>
                    </>
                ))}
            </div>
        );
    }

    const modal = (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
            tabIndex={-1}
        >
            <div
                className="surface w-full max-w-lg border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-auto scrollable scrollable-container"
                style={{ animation: 'py-pop 0.25s ease-out' }}
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
                        {/* Use accordion-style subsections like PortfolioSettingsModal to mirror editor settings */}
                        <PageSettingsSections
                            name={name}
                            setName={setName}
                            starter={starter}
                            setStarter={setStarter}
                            background={background}
                            setBackground={setBackground}
                            backgroundSwatch={backgroundSwatch}
                            themeBackground={themeBackground}
                        />

                        <div className="flex justify-between items-center gap-2 mt-4">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xxs text-red-400 border border-red-500/40 hover:bg-red-500/10"
                                    title="Delete page"
                                    onClick={() => { if (confirm('Delete this page? This cannot be undone.')) onDelete(); }}
                                >
                                    <Trash2 size={14} />
                                    <span>Delete page</span>
                                </button>
                                {onDuplicate && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-xxs"
                                        title="Duplicate page"
                                        onClick={() => { onDuplicate(); onCancel(); }}
                                    >
                                        <Copy size={14} />
                                        <span>Duplicate</span>
                                    </button>
                                )}
                            </div>
                            <button type="submit" className="btn btn-outline btn-xs" disabled={!name.trim()}>
                                Save changes
                            </button>
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
