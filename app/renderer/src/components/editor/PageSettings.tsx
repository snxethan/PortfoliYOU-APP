import React, { useMemo, useState } from "react";
import { Plus, Edit3, Trash2, Settings, RotateCcw, Palette, Copy } from 'lucide-react';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_PAGE_BG = '#ffffff';

export type PageSettingsProps = {
    isCloud: boolean;
    pageOrder: string[];
    pages: Record<string, { title?: string; backgroundColor?: string | null } | undefined>;
    currentPageId: string | null;
    onSelectPage: (id: string | null) => void;
    onCreatePage: () => void;
    onDuplicatePage: () => void;
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
    onDuplicatePage,
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
    const groupLabelClass = "text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]";
    const baseCardClass = "flex flex-col gap-2 px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm min-w-0 w-full overflow-x-hidden";
    const selectClass = "input px-2 py-1 text-sm w-auto max-w-full flex-shrink min-w-0";
    const inputClass = "input flex-1 min-w-0 px-2 py-1 text-sm w-full max-w-full";
    const hexInputClass = "input px-2 py-1 text-sm w-24 flex-shrink-0";
    const rowClass = "inline-flex items-center gap-2 flex-wrap";

    return (
        <div className="grid w-full gap-4 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
            <div className={baseCardClass}>
                <span className={groupLabelClass}>Appearance</span>
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="color"
                        className="w-9 h-9 rounded border border-[color:var(--border)] flex-shrink-0"
                        value={quickSwatch}
                        onChange={(e) => onQuickBackgroundChange(e.target.value)}
                        disabled={!currentPageId}
                        aria-label="Pick page background color"
                    />
                    <input
                        className={hexInputClass}
                        value={((pageBackground || '').trim() || (quickSwatch || '')).toUpperCase()}
                        onChange={(e) => onQuickBackgroundChange(e.target.value)}
                        disabled={!currentPageId}
                    />
                    {hasCustomBackground && (
                        <button
                            className="btn btn-ghost btn-xs flex-shrink-0"
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
                        <button className="btn btn-ghost btn-xs inline-flex items-center gap-2 flex-shrink-0" type="button" title="Page settings" aria-label="Open page settings" onClick={() => onOpenSettings?.()} disabled={!currentPageId}>
                            <Settings size={14} />
                            <span className="text-sm">Page Settings</span>
                        </button>
                    )}
                    {onOpenThemeSettings && (
                        <button className="btn btn-ghost btn-xs inline-flex items-center gap-2 flex-shrink-0" type="button" title="Theme settings" aria-label="Open theme settings" onClick={onOpenThemeSettings}>
                            <Palette size={14} />
                            <span className="text-sm">Theme</span>
                        </button>
                    )}
                </div>
            </div>

            <div className={baseCardClass}>
                <span className={groupLabelClass}>Navigation</span>
                {!editing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button className="btn btn-ghost btn-xs flex-shrink-0" title="Rename page" aria-label="Rename page" onClick={() => {
                            if (!currentPageId) return;
                            const title = pages[currentPageId]?.title || 'Untitled';
                            setDraft(title);
                            setEditing(true);
                        }} disabled={!currentPageId}>
                            <Edit3 size={14} />
                        </button>
                        <select
                            className={selectClass}
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
                        <button className="btn btn-ghost btn-xs flex items-center gap-2 flex-shrink-0" title="New page" aria-label="New page" onClick={() => onCreatePage()}>
                            <Plus size={14} />
                            <span className="text-xs">New page</span>
                        </button>
                        <button className="btn btn-ghost btn-xs flex items-center gap-2 flex-shrink-0" title="Duplicate page" aria-label="Duplicate page" onClick={() => onDuplicatePage()} disabled={!currentPageId}>
                            <Copy size={14} />
                            <span className="text-xs">Duplicate</span>
                        </button>
                        <button className="btn btn-ghost btn-xs text-red-500 border border-red-500/40 hover:bg-red-500/10 flex items-center gap-2 flex-shrink-0" title="Delete current page" aria-label="Delete page" onClick={() => onDeleteCurrentPage()} disabled={!currentPageId}>
                            <Trash2 size={14} />
                            <span className="text-xs">Delete</span>
                        </button>
                    </div>
                ) : (
                    <div className={rowClass}>
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
