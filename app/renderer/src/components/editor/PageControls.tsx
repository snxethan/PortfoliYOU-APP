import React, { useMemo, useState } from "react";
import { Plus, Edit3, Trash2, Settings, Droplet, RotateCcw, Palette } from 'lucide-react';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_PAGE_BG = '#ffffff';

export type PageControlsProps = {
    isCloud: boolean;
    pageOrder: string[];
    pages: Record<string, { title?: string; backgroundColor?: string | null } | undefined>;
    currentPageId: string | null;
    onSelectPage: (id: string | null) => void;
    onCreatePage: () => void;
    onRenameInline: (newName: string) => void;
    onDeleteCurrentPage: () => void;
    onOpenSettings: () => void;
    pageBackground?: string | null;
    themeBackground?: string | null;
    onQuickBackgroundChange: (color: string | null) => void;
    onOpenThemeSettings?: () => void;
};

export default function PageControls({
    isCloud,
    pageOrder,
    pages,
    currentPageId,
    onSelectPage,
    onCreatePage,
    onRenameInline,
    onDeleteCurrentPage,
    onOpenSettings,
    pageBackground,
    themeBackground,
    onQuickBackgroundChange,
    onOpenThemeSettings,
}: PageControlsProps) {
    const [editing, setEditing] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>('');
    const fallbackTheme = useMemo(() => {
        const raw = (themeBackground || '').trim();
        return HEX_COLOR_RE.test(raw) ? raw : DEFAULT_PAGE_BG;
    }, [themeBackground]);
    const quickSwatch = useMemo(() => {
        const raw = (pageBackground || '').trim();
        if (HEX_COLOR_RE.test(raw)) return raw;
        return fallbackTheme;
    }, [pageBackground, fallbackTheme]);
    const hasCustomBackground = Boolean((pageBackground || '').trim());
    const panelClass = "flex flex-col gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/85 px-2 py-1.5 shadow-sm";
    const panelHeaderClass = "w-full flex items-center justify-center gap-1 text-[10px]";
    const panelContentClass = "w-full flex flex-wrap items-center justify-center gap-1 text-[12px]";
    const panelLabelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]";

    return (
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--bg)]">
            <div className="w-full max-w-2xl mx-auto">
                <div className="grid gap-2 md:gap-3 md:grid-cols-2">
                    <div className={panelClass}>
                        <div className={panelHeaderClass}>
                            <span className={panelLabelClass}>Page appearance</span>
                        </div>
                        <div className={panelContentClass}>
                            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]" title="Page background color">
                                <Droplet size={14} />
                                <input
                                    type="color"
                                    className="w-7 h-7 rounded border border-[color:var(--border)] bg-[color:var(--surface)]"
                                    value={quickSwatch}
                                    onChange={(e) => onQuickBackgroundChange(e.target.value)}
                                    disabled={!currentPageId}
                                    aria-label="Pick page background color"
                                />
                            </label>
                            {hasCustomBackground && (
                                <button
                                    className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px]"
                                    type="button"
                                    title="Reset to theme"
                                    aria-label="Reset page background to theme"
                                    onClick={() => onQuickBackgroundChange(null)}
                                    disabled={!currentPageId}
                                >
                                    <RotateCcw size={14} />
                                </button>
                            )}
                            {onOpenThemeSettings && (
                                <button
                                    className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px]"
                                    type="button"
                                    title="Open theme settings"
                                    aria-label="Open theme settings"
                                    onClick={onOpenThemeSettings}
                                    disabled={!currentPageId}
                                >
                                    <Palette size={14} />
                                </button>
                            )}


                            {onOpenSettings && (
                                <button
                                    className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px]"
                                    type="button"
                                    title="Page settings"
                                    aria-label="Open page settings"
                                    onClick={() => onOpenSettings?.()}
                                    disabled={!currentPageId}
                                >
                                    <Settings size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={panelClass}>
                        <div className={panelHeaderClass}>
                            <span className={panelLabelClass}>Page navigation</span>
                        </div>
                        {!editing ? (
                            <div className={panelContentClass}>
                                <button className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px]" title="Rename page" aria-label="Rename page" onClick={() => {
                                    if (!currentPageId) return;
                                    const title = pages[currentPageId]?.title || 'Untitled';
                                    setDraft(title);
                                    setEditing(true);
                                }} disabled={!currentPageId}>
                                    <Edit3 size={14} />
                                </button>
                                <select
                                    className="input px-2 py-1 text-sm w-auto min-w-[130px] md:min-w-[150px]"
                                    value={currentPageId || ''}
                                    onChange={(e) => {
                                        const id = e.target.value || null;
                                        onSelectPage(id);
                                    }}
                                >
                                    {pageOrder.map((pid, i) => {
                                        const disabled = isCloud && i >= 10;
                                        const title = pages[pid]?.title || 'Untitled';
                                        const label = disabled ? `${title} (cloud-unavailable)` : title;
                                        return (
                                            <option key={pid} value={pid} disabled={disabled}>{label}</option>
                                        );
                                    })}
                                </select>
                                <button className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px]" title="New page" aria-label="New page" onClick={() => onCreatePage()}>
                                    <Plus size={14} />
                                </button>
                                <button className="btn btn-ghost btn-xs px-1.5 py-1 min-h-[28px] text-red-500 border border-red-500/40 hover:bg-red-500/10" title="Delete current page" aria-label="Delete page" onClick={() => onDeleteCurrentPage()} disabled={!currentPageId}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className={panelContentClass}>
                                <input
                                    className="input px-2 py-1 text-sm w-auto min-w-[160px] md:min-w-[190px]"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const t = (draft || '').trim();
                                            if (t) { onRenameInline(t); }
                                            setEditing(false);
                                        }
                                        if (e.key === 'Escape') setEditing(false);
                                    }}
                                    autoFocus
                                    placeholder="Page name"
                                />
                                <button className="btn btn-accent btn-xs" onClick={() => { const t = (draft || '').trim(); if (t) { onRenameInline(t); } setEditing(false); }}>Save</button>
                                <button className="btn btn-outline btn-xs" onClick={() => setEditing(false)}>Cancel</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
