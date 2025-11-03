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
    onOpenCloud,
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
    onOpenCloud: (projectIdOrCloudId: { projectId?: string; cloudId?: string }) => void;
}) {
    if (!userSignedIn) return null;
    return (
        <div className="mt-6 surface p-3 border border-[color:var(--border)] rounded-md bg-[color:var(--muted)]/40">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wide">YOUR CLOUD PORTFOLIOS</div>
                <button className="btn btn-ghost btn-xs" title="Refresh cloud" onClick={onRefresh}><RefreshCcw size={14} /></button>
            </div>
            {cloudProjects.length === 0 ? (
                <div className="text-xs text-[color:var(--fg-muted)]">No cloud portfolios yet.</div>
            ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                    {cloudProjects.map(cp => {
                        const linked = localProjects.find(p => p._cloudId === cp.id);
                        const isSelectedCloud = !!linked && (linked.id === selectedProjectId || hoverLinkedId === linked.id);
                        return (
                            <li
                                key={cp.id}
                                className={`py-2 px-2 rounded flex items-center justify-between gap-3 border ${isSelectedCloud ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10' : 'border-transparent'} hover-darker`}
                                onMouseEnter={() => setHoverLinkedId?.(linked?.id || null)}
                                onMouseLeave={() => setHoverLinkedId?.(null)}
                                onClick={() => { if (linked) onSelectLocal(linked.id); }}
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate flex items-center gap-2">
                                        <span className="truncate">{cp.name}</span>
                                        {isSelectedCloud && (
                                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--accent)] text-black border border-[color:var(--accent-700)]">Selected</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[color:var(--fg-muted)]">Updated {new Date(cp.updatedAt).toLocaleString()} {linked ? '· Linked' : '· Not linked'} · {(cloudInfo[cp.id]?.sizeBytes ? (cloudInfo[cp.id].sizeBytes / (1024 * 1024)).toFixed(3) + ' MB' : '0.000 MB')}</div>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <button
                                        className={`btn btn-ghost btn-xs ${linked ? 'cloud-linked' : ''}`}
                                        title="Cloud settings"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (linked) { onOpenCloud({ projectId: linked.id }); }
                                            else { onOpenCloud({ cloudId: cp.id }); }
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
