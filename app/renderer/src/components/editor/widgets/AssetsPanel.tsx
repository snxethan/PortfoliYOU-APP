import React, { useMemo, useRef, useState } from 'react';
import { CloudUpload, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';

import { useAssets } from '../../../providers/AssetsProvider';
import { useNotifications } from '../../../providers/NotificationsProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { useProjects } from '../../../providers/ProjectsProvider';

export default function AssetsPanel({ hideHeader = false }: { hideHeader?: boolean }) {
    const { list, getUrl, remove, syncToCloud, addFiles } = useAssets();
    const { add: notify } = useNotifications();
    const { user } = useAuth();
    const { selectedProject } = useProjects();
    const isCloudProject = !!(selectedProject as unknown as { _cloudId?: string })?._cloudId;
    const [syncing, setSyncing] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');
    const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => ({ Images: true, Audio: true, Video: true, Other: true }));
    const [uploading, setUploading] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return list.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [list, query]);
    // Debug log: show list count and filtered count
    React.useEffect(() => { console.info('AssetsPanel: selectedProjectId=', selectedProject?.id, 'listCount=', list.length, 'filteredCount=', filtered.length); }, [list, filtered.length, selectedProject?.id]);

    type Cat = 'Images' | 'Audio' | 'Video' | 'Other';
    const grouped = useMemo(() => {
        const map = new Map<Cat, typeof filtered>();
        const isImageAsset = (a: typeof filtered[number]) => (a.type?.startsWith('image/')) || ((a.width ?? 0) > 0 && (a.height ?? 0) > 0);
        for (const a of filtered) {
            let key: Cat = 'Other';
            if (isImageAsset(a)) key = 'Images';
            else if (a.type?.startsWith('audio/')) key = 'Audio';
            else if (a.type?.startsWith('video/')) key = 'Video';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(a);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    const triggerUpload = () => {
        uploadInputRef.current?.click();
    };

    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        if (!selectedProject) {
            try { notify({ type: 'error', message: 'Select a portfolio before uploading assets.', persistent: false }); } catch { /* noop */ }
            setUploading(false);
            if (uploadInputRef.current) uploadInputRef.current.value = '';
            return;
        }
        try {
            const metas = await addFiles(files);
            if (isCloudProject && user) {
                for (const meta of metas) {
                    try {
                        setSyncing(s => ({ ...s, [meta.hash]: true }));
                        await syncToCloud(meta.hash);
                    } catch (err) {
                        console.error('AssetsPanel: syncToCloud failed', err);
                        try { notify({ type: 'error', message: `Failed to sync ${meta.name} to cloud`, persistent: false }); } catch { /* noop */ }
                    } finally {
                        setSyncing(s => ({ ...s, [meta.hash]: false }));
                    }
                }
            }
        } catch (err) {
            console.error('AssetsPanel: addFiles failed', err);
            try { notify({ type: 'error', message: 'Failed to upload assets', persistent: false }); } catch { /* noop */ }
        } finally {
            setUploading(false);
            if (uploadInputRef.current) uploadInputRef.current.value = '';
        }
    };

    return (
        <div className="mt-2">
            {!hideHeader && (
                <div className="flex items-center justify-between mb-2 text-sm font-medium">Assets</div>
            )}
            <div className="flex items-center justify-between mb-2 gap-2">
                <button
                    className={`btn btn-ghost btn-sm w-full justify-center gap-2 border border-dashed border-[color:var(--border)] hover-accent transition ${uploading ? 'opacity-60 cursor-wait' : ''}`}
                    type="button"
                    onClick={triggerUpload}
                    disabled={uploading}
                    title="Upload media"
                    aria-busy={uploading}
                >
                    <CloudUpload size={14} />
                    <span>{uploading ? 'Uploading…' : 'Upload assets'}</span>
                </button>
                <input
                    ref={uploadInputRef}
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                />
            </div>
            <div className="mb-2">
                <div className="relative">
                    <input className="input w-full pl-7" placeholder="Search assets…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--fg-muted)]" />
                </div>
            </div>
            {filtered.length > 0 ? (
                <div className="space-y-2">
                    {grouped.map(([cat, items]) => (
                        <div key={cat} className="border border-[color:var(--border)] rounded-md overflow-hidden">
                            <button
                                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-[color:var(--muted)]/40 text-[10px] tracking-wide uppercase"
                                onClick={() => setOpenMap(prev => ({ ...prev, [cat]: !(prev[cat] ?? true) }))}
                            >
                                <span className="inline-flex items-center gap-2">{(openMap[cat] ?? true) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{cat}</span>
                                <span className="text-[color:var(--fg-muted)]">{items.length}</span>
                            </button>
                            {(openMap[cat] ?? true) && (
                                <div className="p-2 grid grid-cols-2 gap-2">
                                    {items.map((a) => (
                                        <AssetItem
                                            key={a.hash}
                                            hash={a.hash}
                                            name={a.name}
                                            type={a.type}
                                            onRemove={() => remove(a.hash)}
                                            onSync={isCloudProject && user ? () => syncToCloud(a.hash) : undefined}
                                            syncing={!!syncing[a.hash]}
                                            setSyncing={(v: boolean) => setSyncing(s => ({ ...s, [a.hash]: v }))}
                                            getUrl={getUrl}
                                            cloudUrl={a.cloudUrl}
                                            isCloudProject={isCloudProject}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-[color:var(--fg-muted)] text-xs">No assets match your search.</div>
            )}
        </div>
    );
}

type AssetItemProps = {
    hash: string;
    name: string;
    type?: string;
    onRemove: () => Promise<void>;
    onSync?: () => Promise<unknown>;
    syncing: boolean;
    setSyncing: (v: boolean) => void;
    getUrl: (hash: string) => Promise<string | null>;
    cloudUrl?: string;
    isCloudProject?: boolean;
}

const AssetItem: React.FC<AssetItemProps> = ({ hash, name, type, onRemove, onSync, syncing, setSyncing, getUrl, cloudUrl, isCloudProject }) => {
    const [url, setUrl] = useState<string | null>(null);
    React.useEffect(() => { let alive = true; getUrl(hash).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [hash, getUrl]);
    const isVideo = (type || '').startsWith('video/');
    return (
        <div
            className="border border-[color:var(--border)] rounded-md overflow-hidden transition hover-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
            draggable
            tabIndex={0}
            role="button"
            aria-label={`Drag asset ${name}`}
            onDragStart={(e) => {
                // Provide custom and fallback types for easiest integration
                try { e.dataTransfer.setData('application/x-asset-hash', hash); } catch { /* ignore */ }
                try { e.dataTransfer.setData('text/asset-hash', hash); } catch { /* ignore */ }
                try { e.dataTransfer.setData('text/plain', `asset://${hash}`); } catch { /* ignore */ }
            }}
            title="Drag onto a widget to use this asset"
        >
            <div className="w-full aspect-square bg-[color:var(--muted)]/40 flex items-center justify-center overflow-hidden">
                {url ? (
                    isVideo ? (
                        <video src={url} className="w-full h-full object-cover" muted loop playsInline preload="metadata" />
                    ) : (
                        <img src={url} alt={name} className="w-full h-full object-cover" />
                    )
                ) : (
                    <div className="text-[10px] text-[color:var(--fg-muted)]">Loading…</div>
                )}
            </div>
            <div className="flex items-center gap-2 px-2 py-2 border-t border-[color:var(--border)] bg-[color:var(--surface)]/60">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate" title={name || hash}>{name || hash}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">{cloudUrl ? 'Cloud copy' : 'Local only'}</p>
                </div>
                <div className="flex items-center gap-1">
                    {onSync && isCloudProject && (
                        <button
                            type="button"
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${cloudUrl ? 'border-[color:var(--accent)]/50 text-[color:var(--accent)] bg-[color:var(--accent)]/10' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'} transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]`}
                            title={cloudUrl ? 'Asset synced to cloud' : 'Sync asset to cloud'}
                            aria-label={cloudUrl ? 'Asset synced to cloud' : 'Sync asset to cloud'}
                            onClick={async () => {
                                if (syncing) return;
                                setSyncing(true);
                                try { await onSync(); }
                                finally { setSyncing(false); }
                            }}
                            disabled={syncing}
                        >
                            {syncing ? <span className="w-3 h-3 border-2 border-[color:var(--border)] border-t-transparent rounded-full animate-spin" aria-hidden="true"></span> : <CloudUpload size={12} />}
                        </button>
                    )}
                    <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/40 text-red-500 hover:bg-red-500/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                        title="Delete asset"
                        aria-label="Delete asset"
                        onClick={onRemove}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
