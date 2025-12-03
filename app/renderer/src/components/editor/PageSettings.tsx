import React, { useMemo, useState } from "react";
import { Plus, Edit3, Trash2, Settings, Droplet, RotateCcw, Palette } from 'lucide-react';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_PAGE_BG = '#ffffff';

export type PageSettingsProps = {
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

export default function PageSettings({
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
}: PageSettingsProps) {
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
    const rowClass = "flex flex-wrap items-center gap-3 w-full";
    const appearanceClass = "flex items-center gap-2 flex-1 min-w-[200px] min-w-0 px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm";
    const navigationClass = "flex flex-wrap sm:flex-nowrap items-center gap-2 flex-none px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm";
    const groupLabelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]";
    const panelContentClass = "w-full text-[12px]";
    const panelLabelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)] w-28";
    const inputClass = "input px-2 py-1 text-sm w-auto md:w-auto min-w-0 md:min-w-[160px] max-w-[10rem]";

    return (
        <div className={rowClass}>
            <div className={appearanceClass}>
                <span className={groupLabelClass}>appearance</span>
                <div className="flex items-start gap-2 flex-wrap">
                    <input
                        type="color"
                        className="w-9 h-9 rounded border border-[color:var(--border)]"
                        value={quickSwatch}
                        onChange={(e) => onQuickBackgroundChange(e.target.value)}
                        disabled={!currentPageId}
                        aria-label="Pick page background color"
                    />
                    <input
                        className={inputClass}
                        value={((pageBackground || '').trim() || (quickSwatch || '')).toUpperCase()}
                        onChange={(e) => onQuickBackgroundChange(e.target.value)}
                        disabled={!currentPageId}
                    />
                    {hasCustomBackground && (
                        <button
                            className="btn btn-ghost btn-xs"
                            type="button"
                            title="Reset to theme"
                            aria-label="Reset page background to theme"
                            onClick={() => onQuickBackgroundChange(null)}
                            disabled={!currentPageId}
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                    {onOpenSettings && (
                        <button className="btn btn-ghost btn-xs inline-flex items-center gap-2" type="button" title="Page settings" aria-label="Open page settings" onClick={() => onOpenSettings?.()} disabled={!currentPageId}>
                            <Settings size={14} />
                            <span className="text-sm">Page Settings</span>
                        </button>
                    )}
                </div>
            </div>

            <div className={navigationClass}>
                <span className={groupLabelClass}>navigation</span>
                {!editing ? (
                    <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <button className="btn btn-ghost btn-xs" title="Rename page" aria-label="Rename page" onClick={() => {
                            if (!currentPageId) return;
                            const title = pages[currentPageId]?.title || 'Untitled';
                            setDraft(title);
                            setEditing(true);
                        }} disabled={!currentPageId}>
                            <Edit3 size={14} />
                        </button>
                        <select
                            className={inputClass}
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
                        <button className="btn btn-ghost btn-xs" title="New page" aria-label="New page" onClick={() => onCreatePage()}>
                            <Plus size={14} />
                        </button>
                        <button className="btn btn-ghost btn-xs text-red-500 border border-red-500/40 hover:bg-red-500/10" title="Delete current page" aria-label="Delete page" onClick={() => onDeleteCurrentPage()} disabled={!currentPageId}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <input
                            className={inputClass}
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
                        <button className="btn btn-accent btn-xs" onClick={() => { const t = (draft || '').trim(); if (t) { onRenameInline(t); } setEditing(false); }}>
                            <span className="text-xs">Save</span>
                        </button>
                        <button className="btn btn-outline btn-xs" onClick={() => setEditing(false)}>
                            <span className="text-xs">Cancel</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
