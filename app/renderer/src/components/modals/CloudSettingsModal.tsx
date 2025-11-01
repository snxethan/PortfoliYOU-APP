import React, { useEffect, useState } from 'react';
import { UploadCloud, X, Edit3, Download, Trash2, RefreshCcw } from 'lucide-react';

export default function CloudSettingsModal({
    open,
    onClose,
    mode,
    titleName,
    statusText,
    actions,
    saving,
    lastSavedAt,
}: {
    open: boolean;
    onClose: () => void;
    mode: 'linked' | 'cloud';
    titleName: string;
    statusText: string;
    saving?: boolean;
    lastSavedAt?: string | null;
    actions: {
        refreshInfo: () => Promise<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>;
        renameCloud?: (newName: string) => Promise<boolean>;
        deleteCloud?: () => Promise<boolean>;
        importLocalCopy?: () => Promise<void>;
        sync?: () => Promise<void>;
        unlinkKeepCloud?: () => Promise<void>;
        saveToDisk?: () => Promise<void>;
        importAndLink?: () => Promise<void>;
        importLocalOnly?: () => Promise<void>;
    };
}) {
    if (!open) return null;
    const [info, setInfo] = useState<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    useEffect(() => {
        let alive = true;
        const load = async () => {
            if (!open) return;
            setLoadingInfo(true);
            try {
                const v = await actions.refreshInfo();
                if (alive) setInfo(v);
            } catch {
                // ignore
            } finally {
                if (alive) setLoadingInfo(false);
            }
        };
        load();
        return () => { alive = false; };
    }, [open]);

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
                    <h4 className="text-base font-semibold">Cloud settings</h4>
                </div>
                {/* Name first for consistency */}
                <div className="mb-3">
                    <label className="block text-[color:var(--fg-muted)] mb-1 text-sm">Name</label>
                    <div className="input w-full text-sm pointer-events-none select-text" title={titleName}>{titleName}</div>
                </div>
                <div className="text-sm mb-2">
                    <div>Status: <span className="text-[color:var(--fg-muted)]">{statusText}</span></div>
                </div>
                {mode === 'linked' && (
                    <div className="text-xs mb-3 text-[color:var(--fg-muted)]">
                        Autosave: Enabled for files {saving ? '(saving...)' : lastSavedAt ? `· Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <div className="bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-md p-3">
                        {mode === 'linked' ? (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="btn btn-outline btn-sm" onClick={actions.sync} title="Sync to cloud"><UploadCloud size={14} className="mr-1" /> Sync</button>
                                    {actions.unlinkKeepCloud && (
                                        <button className="btn btn-outline btn-sm" onClick={actions.unlinkKeepCloud} title="Unlink from cloud"><X size={14} className="mr-1" /> Unlink</button>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={actions.saveToDisk} title="Save to file"><Download size={14} className="mr-1" /> Save file</button>
                                    {actions.importLocalCopy && (
                                        <button className="btn btn-ghost btn-sm" onClick={actions.importLocalCopy} title="Import a separate local copy"><Download size={14} className="mr-1" /> Import cloud copy</button>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-1">
                                    {actions.renameCloud && (
                                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                                            const rename = actions.renameCloud; if (!rename) return;
                                            const next = prompt('Rename cloud portfolio', titleName);
                                            if (next && next.trim() && next.trim() !== titleName) await rename(next.trim());
                                        }} title="Rename cloud portfolio"><Edit3 size={14} className="mr-1" /> Rename</button>
                                    )}
                                    {actions.deleteCloud && (
                                        <button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" onClick={async () => { const del = actions.deleteCloud; if (del && confirm('Delete cloud copy? This cannot be undone.')) await del(); }} title="Delete cloud copy"><Trash2 size={14} className="mr-1" /> Delete cloud</button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    {actions.importAndLink && (
                                        <button className="btn btn-outline btn-sm" onClick={actions.importAndLink} title="Import and link to cloud"><Download size={14} className="mr-1" /> Import & link</button>
                                    )}
                                    {actions.importLocalOnly && (
                                        <button className="btn btn-outline btn-sm" onClick={actions.importLocalOnly} title="Import as local-only"><Download size={14} className="mr-1" /> Import local-only</button>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-1">
                                    {actions.renameCloud && (
                                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                                            const rename = actions.renameCloud; if (!rename) return;
                                            const next = prompt('Rename cloud portfolio', titleName);
                                            if (next && next.trim() && next.trim() !== titleName) await rename(next.trim());
                                        }} title="Rename cloud portfolio"><Edit3 size={14} className="mr-1" /> Rename</button>
                                    )}
                                    {actions.deleteCloud && (
                                        <button className="btn px-2 py-1 text-white bg-red-600 hover:bg-red-700 border-red-700 btn-sm" onClick={async () => { const del = actions.deleteCloud; if (del && confirm('Delete cloud portfolio?')) await del(); }} title="Delete cloud portfolio"><Trash2 size={14} className="mr-1" /> Delete</button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="mt-2 p-3 border border-[color:var(--border)] rounded text-xs bg-[color:var(--muted)]/40">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold">Cloud details</div>
                            <button className="btn btn-ghost btn-xs" title="Refresh" onClick={async () => { setLoadingInfo(true); try { const v = await actions.refreshInfo(); setInfo(v); } finally { setLoadingInfo(false); } }}><RefreshCcw size={12} /></button>
                        </div>
                        {loadingInfo ? (
                            <div className="text-[color:var(--fg-muted)]">Loading…</div>
                        ) : info ? (
                            <div className="mt-1 space-y-1">
                                <div><span className="text-[color:var(--fg-muted)]">Path:</span> <span className="font-mono break-all">{info.storagePath}</span></div>
                                <div><span className="text-[color:var(--fg-muted)]">Size:</span> {(info.sizeBytes / (1024 * 1024)).toFixed(3)} MB</div>
                                <div><span className="text-[color:var(--fg-muted)]">Updated:</span> {new Date(info.updatedAt).toLocaleString()}</div>
                            </div>
                        ) : (
                            <div className="text-[color:var(--fg-muted)]">Click Refresh to fetch object details.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
