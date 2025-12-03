import React from "react";
import { Cloud, FolderOpen, FolderUp, Settings, Trash2, UploadCloud, Wrench } from "lucide-react";

export type LocalProject = {
    id: string;
    name: string;
    updatedAt: number;
    _filePath?: string;
    _synced?: boolean;
    _cloudId?: string;
    storage?: 'local' | 'cloud';
};

export default function ProjectsList({
    projects,
    selectedProjectId,
    userSignedIn,
    onSelect,
    onDelete,
    onDeleteCloud,
    onSaveAs,
    onOpenFileLocation,
    onOpenEditor,
    onOpenDeploy,
    onOpenSettings,
}: {
    projects: LocalProject[];
    selectedProjectId?: string | null;
    userSignedIn: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, opts: { deleteFile?: boolean }) => Promise<void>;
    onDeleteCloud?: (cloudId: string) => Promise<void>;
    onSaveAs: (id: string) => Promise<void>;
    onOpenFileLocation: (filePath: string) => Promise<void> | void;
    onOpenEditor: (id: string) => void;
    onOpenDeploy: (id: string) => void;
    onOpenSettings: (id: string, section?: 'portfolio' | 'cloud') => void;
}) {
    return (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-4 portfolio-workspace-list">
            <div className="portfolio-workspace-list__header">
                <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Portfolios</p>
                    <p className="text-xs text-[color:var(--fg-muted)]">Manage local files and cloud projects from one place.</p>
                </div>
                <span className="portfolio-workspace-list__count text-xs text-[color:var(--fg-muted)]">{projects.length} active</span>
            </div>
            {projects.length === 0 ? (
                <div className="text-sm text-[color:var(--fg-muted)]">No recent items.</div>
            ) : (
                <ul className="space-y-3">
                    {projects.map(p => {
                        const isActive = selectedProjectId === p.id;
                        const isCloud = (p as unknown as { storage?: string; _cloudId?: string }).storage === 'cloud' || Boolean((p as unknown as { _cloudId?: string })._cloudId);
                        return (
                            <li
                                key={p.id}
                                className={`rounded-xl border px-3 py-3 flex flex-col gap-3 transition cursor-pointer ${isActive ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-lg shadow-[color:var(--accent)]/10' : 'border-[color:var(--border)] bg-[color:var(--muted)]/40 hover-accent'}`}
                                onClick={() => onSelect(p.id)}
                                title={p._filePath || ''}
                            >
                                <div className="portfolio-workspace-list__item">
                                    <div className="portfolio-workspace-list__item-info">
                                        <div className="text-sm font-semibold truncate flex items-center gap-2" title={p.name}>
                                            <span className="truncate">{p.name}</span>
                                            {isCloud && <Cloud size={12} className="text-[color:var(--accent)]" aria-label="Cloud project" />}
                                            {selectedProjectId === p.id && (
                                                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Active</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[color:var(--fg-muted)]">{isCloud ? 'Cloud' : 'Local'} · Updated {new Date(p.updatedAt).toLocaleString()}</div>
                                    </div>

                                    <div className="portfolio-workspace-list__item-actions">
                                        {!isCloud && !p._filePath ? (
                                            <button className="btn btn-ghost btn-xxs" title="Save As…" onClick={async (e) => { e.stopPropagation(); await onSaveAs(p.id); }}><FolderUp size={14} /></button>
                                        ) : null}
                                        {!isCloud && p._filePath && (
                                            <button className="btn btn-ghost btn-xxs" title="Open file location" onClick={async (e) => { e.stopPropagation(); if (p._filePath) await onOpenFileLocation(p._filePath); }}><FolderOpen size={14} /></button>
                                        )}
                                        <button className="btn btn-ghost btn-xxs" title="Editor" onClick={(e) => { e.stopPropagation(); onOpenEditor(p.id); }}><Wrench size={14} /></button>
                                        <button className="btn btn-ghost btn-xxs" title="Deploy" onClick={(e) => { e.stopPropagation(); onOpenDeploy(p.id); }}><UploadCloud size={14} /></button>
                                        <button
                                            className="btn btn-ghost btn-xxs"
                                            title="Portfolio settings"
                                            onClick={(e) => { e.stopPropagation(); onOpenSettings(p.id, 'portfolio'); }}
                                        >
                                            <Settings size={14} />
                                        </button>
                                        <button
                                            className={`btn btn-ghost btn-xxs ${isCloud ? 'text-[color:var(--accent)]' : ''}`}
                                            title={isCloud ? 'Cloud project settings' : 'Link to cloud'}
                                            onClick={(e) => { e.stopPropagation(); onOpenSettings(p.id, 'cloud'); }}
                                            disabled={!userSignedIn}
                                        >
                                            <Cloud size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-xxs text-red-400 border border-red-500/40 hover:bg-red-500/10" title="Delete" onClick={async (e) => {
                                            e.stopPropagation();
                                            if (isCloud) {
                                                if (!userSignedIn) {
                                                    window.alert('Sign in to delete cloud portfolios.');
                                                    return;
                                                }
                                                if (!onDeleteCloud) {
                                                    window.alert('Cloud deletion is unavailable.');
                                                    return;
                                                }
                                                const cloudId = (p as unknown as { _cloudId?: string })._cloudId || p.id;
                                                const confirmCloud = window.confirm(`Delete cloud portfolio "${p.name}" from your account? This removes it from the cloud list.`);
                                                if (!confirmCloud) return;
                                                await onDeleteCloud(cloudId);
                                                return;
                                            }
                                            const confirmDelete = window.confirm(`Delete "${p.name}" from the list${(!isCloud && p._filePath) ? ' (file can optionally be removed next)' : ''}?`);
                                            if (!confirmDelete) return;
                                            let deleteFile = false;
                                            if (!isCloud && p._filePath) {
                                                deleteFile = window.confirm('Also delete the .portfoliyou file from disk? This cannot be undone.');
                                            }
                                            await onDelete(p.id, { deleteFile });
                                        }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
