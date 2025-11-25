import React from "react";
import { Cloud, RefreshCcw } from "lucide-react";

export type CloudProject = { id: string; name: string; updatedAt: string; storagePath: string };

export default function CloudProjectsList({
    userSignedIn,
    cloudProjects,
    cloudInfo,
    localProjects,
    selectedProjectId,
    hoverLinkedId,
    setHoverLinkedId,
    onRefresh,
    onSelectLocal,
    onOpenSettings,
}: {
    userSignedIn: boolean;
    cloudProjects: CloudProject[];
    cloudInfo: Record<string, { storagePath: string; sizeBytes: number; updatedAt: string }>;
    localProjects: Array<{ id: string; _cloudId?: string }>;
    selectedProjectId?: string | null;
    hoverLinkedId?: string | null;
    setHoverLinkedId?: (id: string | null) => void;
    onRefresh: () => Promise<void>;
    onSelectLocal: (id: string) => void;
    onOpenSettings: (target: { projectId?: string; cloudId?: string }) => void;
}) {
    if (!userSignedIn) return null;
    return (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Cloud portfolios</p>
                    <p className="text-xs text-[color:var(--fg-muted)]">Projects synced to your account.</p>
                </div>
                <button className="btn btn-ghost btn-xxs" title="Refresh cloud" onClick={onRefresh}><RefreshCcw size={14} /></button>
            </div>
            {cloudProjects.length === 0 ? (
                <div className="text-xs text-[color:var(--fg-muted)]">No cloud portfolios yet.</div>
            ) : (
                <ul className="space-y-3">
                    {cloudProjects.map(cp => {
                        const linked = localProjects.find(p => p._cloudId === cp.id);
                        const isSelectedCloud = !!linked && (linked.id === selectedProjectId || hoverLinkedId === linked.id);
                        return (
                            <li
                                key={cp.id}
                                className={`rounded-xl border px-3 py-3 flex flex-col gap-3 transition ${isSelectedCloud ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5 shadow-lg shadow-[color:var(--accent)]/10' : 'border-[color:var(--border)] bg-[color:var(--muted)]/40 hover-accent'}`}
                                onMouseEnter={() => setHoverLinkedId?.(linked?.id || null)}
                                onMouseLeave={() => setHoverLinkedId?.(null)}
                                onClick={() => { if (linked) onSelectLocal(linked.id); }}
                            >
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate flex items-center gap-2">
                                            <span className="truncate">{cp.name}</span>
                                            {isSelectedCloud && (
                                                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Linked</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(cp.updatedAt).toLocaleString()} · {linked ? 'Linked' : 'Not linked'} · {(cloudInfo[cp.id]?.sizeBytes ? (cloudInfo[cp.id].sizeBytes / (1024 * 1024)).toFixed(3) + ' MB' : '0.000 MB')}</div>
                                    </div>
                                    <button
                                        className={`btn btn-ghost btn-xxs ${linked ? 'cloud-linked' : ''}`}
                                        title="Portfolio settings"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (linked) { onOpenSettings({ projectId: linked.id, cloudId: cp.id }); }
                                            else { onOpenSettings({ cloudId: cp.id }); }
                                        }}
                                    >
                                        <Cloud size={14} className={linked ? 'cloud-linked-icon' : ''} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
