import React, { useState } from "react";
import { Plus, Edit3, Trash2, Settings } from 'lucide-react';

export type PageControlsProps = {
    isCloud: boolean;
    pageOrder: string[];
    pages: Record<string, { title?: string } | undefined>;
    currentPageId: string | null;
    onSelectPage: (id: string | null) => void;
    onCreatePage: () => void;
    onRenameCurrentPage: () => void; // deprecated in favor of inline rename
    onRenameInline: (newName: string) => void;
    onDeleteCurrentPage: () => void;
    onOpenSettings: () => void;
};

export default function PageControls({
    isCloud,
    pageOrder,
    pages,
    currentPageId,
    onSelectPage,
    onCreatePage,
    onRenameCurrentPage,
    onRenameInline,
    onDeleteCurrentPage,
    onOpenSettings,
}: PageControlsProps) {
    const [editing, setEditing] = useState<boolean>(false);
    const [draft, setDraft] = useState<string>('');
    return (
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--bg)]">
            <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                    {/* Left-side controls: settings / rename / delete */}
                    <button className="btn btn-ghost btn-xs" title="Page settings" aria-label="Page settings" onClick={() => onOpenSettings?.()} disabled={!currentPageId}>
                        <Settings size={14} />
                    </button>
                    {!editing && (
                        <>
                            <button className="btn btn-ghost btn-xs" title="Rename page" aria-label="Rename page" onClick={() => {
                                if (!currentPageId) return;
                                const title = pages[currentPageId]?.title || 'Untitled';
                                setDraft(title);
                                setEditing(true);
                            }} disabled={!currentPageId}>
                                <Edit3 size={14} />
                            </button>
                        </>
                    )}

                    {/* Center: selector or inline rename replaces it when editing */}
                    {!editing ? (
                        <>
                            <select
                                className="input px-2 py-1 text-sm"
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
                            {/* New page button on the right of selector */}
                            <button className="btn btn-ghost btn-xs" title="New page" aria-label="New page" onClick={() => onCreatePage()}>
                                <Plus size={14} />
                            </button>
                            {/* Delete page button to the right of plus */}
                            <button className="btn btn-ghost btn-xs" title="Delete current page" aria-label="Delete page" onClick={() => onDeleteCurrentPage()} disabled={!currentPageId}>
                                <Trash2 size={14} />
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                className="input px-2 py-1 text-sm"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { const t = (draft || '').trim(); if (t) { onRenameInline(t); } setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
                                autoFocus
                                placeholder="Page name"
                            />
                            <button className="btn btn-primary btn-xs" onClick={() => { const t = (draft || '').trim(); if (t) { onRenameInline(t); } setEditing(false); }}>Save</button>
                            <button className="btn btn-outline btn-xs" onClick={() => setEditing(false)}>Cancel</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
