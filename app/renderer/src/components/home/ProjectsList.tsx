import React, { useState } from "react";
import { CheckCircle2, Cloud, Edit3, FolderOpen, FolderUp, Trash2, UploadCloud, Wrench } from "lucide-react";

export type LocalProject = {
    id: string;
    name: string;
    updatedAt: number;
    _filePath?: string;
    _synced?: boolean;
};

export default function ProjectsList({
    projects,
    selectedProjectId,
    hoverLinkedId,
    userSignedIn,
    onSelect,
    onRename,
    onDelete,
    onExport,
    onSaveAs,
    onOpenFileLocation,
    onOpenEditor,
    onOpenDeploy,
    onOpenCloud,
}: {
    projects: LocalProject[];
    selectedProjectId?: string | null;
    hoverLinkedId?: string | null;
    userSignedIn: boolean;
    onSelect: (id: string) => void;
    onRename: (id: string, name: string) => Promise<void>;
    onDelete: (id: string, opts: { deleteFile?: boolean }) => Promise<void>;
    onExport: (id: string) => void;
    onSaveAs: (id: string) => Promise<void>;
    onOpenFileLocation: (filePath: string) => Promise<void> | void;
    onOpenEditor: (id: string) => void;
    onOpenDeploy: (id: string) => void;
    onOpenCloud: (id: string) => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');
    return (
        <div className="surface p-3 border border-[color:var(--border)] rounded-md">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2">YOUR LOCAL PORTFOLIOS</div>
            {projects.length === 0 ? (
                <div className="text-sm text-[color:var(--fg-muted)]">No recent items.</div>
            ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                    {projects.map(p => (
                        <li
                            key={p.id}
                            className={`py-2 px-2 rounded cursor-pointer flex items-center justify-between gap-3 border ${(selectedProjectId === p.id || hoverLinkedId === p.id) ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10' : 'border-transparent'} hover-darker`}
                            onClick={() => onSelect(p.id)}
                            title={p._filePath || ''}
                        >
                            <div className="min-w-0">
                                {editingId === p.id ? (
                                    <div className="flex items-center gap-2">
                                        <input className="input w-64" value={editDraft} onChange={e => setEditDraft(e.target.value)} onClick={(e) => e.stopPropagation()} />
                                        <button className="btn btn-primary btn-xs" onClick={async (e) => { e.stopPropagation(); const v = editDraft.trim(); if (v) await onRename(p.id, v); setEditingId(null); }}><CheckCircle2 size={14} /></button>
                                        <button className="btn btn-outline btn-xs" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-sm font-medium truncate flex items-center gap-1" title={p.name}>
                                            <span className="truncate">{p.name}</span>
                                            {p._synced && <span className="inline-flex" aria-label="Cloud project"><Cloud size={12} className="text-[color:var(--accent)]" /></span>}
                                            <button className="btn btn-ghost text-xs px-1" title="Rename" onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditDraft(p.name); }}><Edit3 size={12} /></button>
                                            {selectedProjectId === p.id && (
                                                <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Selected</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(p.updatedAt).toLocaleString()}</div>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-1">
                                {!p._filePath ? (
                                    <button className="btn btn-ghost text-xs" title="Save As…" onClick={async (e) => { e.stopPropagation(); await onSaveAs(p.id); }}><FolderUp size={14} /></button>
                                ) : (
                                    <button className="btn btn-ghost text-xs" title="Open file location" onClick={async (e) => { e.stopPropagation(); if (p._filePath) await onOpenFileLocation(p._filePath); }}><FolderOpen size={14} /></button>
                                )}
                                <button className="btn btn-ghost text-xs bg-[color:var(--muted)]/60 hover:bg-[color:var(--muted)]" title="Editor" onClick={(e) => { e.stopPropagation(); onOpenEditor(p.id); }}><Wrench size={14} /></button>
                                <button className="btn btn-ghost text-xs bg-[color:var(--muted)]/60 hover:bg-[color:var(--muted)]" title="Deploy" onClick={(e) => { e.stopPropagation(); onOpenDeploy(p.id); }}><UploadCloud size={14} /></button>
                                {userSignedIn && (
                                    <button
                                        className={`btn btn-ghost text-xs ${p._synced ? 'cloud-linked' : ''}`}
                                        title="Cloud settings"
                                        onClick={(e) => { e.stopPropagation(); onOpenCloud(p.id); }}
                                    >
                                        <Cloud size={14} className={p._synced ? 'cloud-linked-icon' : ''} />
                                    </button>
                                )}
                                <button className="btn btn-ghost text-xs" title="Delete" onClick={async (e) => {
                                    e.stopPropagation();
                                    const confirmDelete = window.confirm(`Delete "${p.name}" from the list${p._filePath ? ' (file can optionally be removed next)' : ''}?`);
                                    if (!confirmDelete) return;
                                    let deleteFile = false;
                                    if (p._filePath) {
                                        deleteFile = window.confirm('Also delete the .portfoliyou file from disk? This cannot be undone.');
                                    }
                                    await onDelete(p.id, { deleteFile });
                                }}><Trash2 size={14} /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
