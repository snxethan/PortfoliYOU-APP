import React, { useEffect, useState } from "react";
import { createPortal } from 'react-dom';
import { Layers, X } from 'lucide-react';

export default function PageSettingsModal({
    title = "Page settings",
    initialName = "",
    initialStarter = false,
    onCancel,
    onSave,
    onDelete,
}: {
    title?: string;
    initialName?: string;
    initialStarter?: boolean;
    onCancel: () => void;
    onSave: (opts: { name: string; starter: boolean }) => void;
    onDelete: () => void;
}) {
    const [name, setName] = useState(initialName || "");
    const [starter, setStarter] = useState<boolean>(Boolean(initialStarter));

    useEffect(() => {
        setName(initialName || "");
    }, [initialName]);
    useEffect(() => { setStarter(Boolean(initialStarter)); }, [initialStarter]);

    const modal = (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
            tabIndex={-1}
        >
            <div
                className="surface p-5 w-full max-w-md border border-[color:var(--border)] rounded-md max-h-[85vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-center mb-3 relative">
                    <button className="btn btn-ghost btn-xs absolute right-0 top-0" onClick={onCancel} aria-label="Close">
                        <X size={14} />
                    </button>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Layers size={16} /> Page settings
                    </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const v = name.trim(); if (v) onSave({ name: v, starter }); }}>
                    <label className="text-sm text-[color:var(--fg-muted)]">Name</label>
                    <input
                        className="input w-full mb-3"
                        placeholder="Page name"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <div className="flex items-center gap-3 mb-3">
                        <input id="starter-toggle" type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
                        <label htmlFor="starter-toggle" className="text-sm">Default page</label>
                    </div>

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
                        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Save</button>
                    </div>
                </form>
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
