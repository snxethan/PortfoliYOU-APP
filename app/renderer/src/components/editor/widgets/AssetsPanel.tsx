import React, { useMemo, useState } from 'react';
import { CloudUpload, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAssets } from '../../../providers/AssetsProvider';
import { useAuth } from '../../../providers/AuthProvider';

export default function AssetsPanel({ hideHeader = false }: { hideHeader?: boolean }) {
    const { list, getUrl, remove, syncToCloud } = useAssets();
    const { user } = useAuth();
    const [syncing, setSyncing] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');
    const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => ({ Images: true, Audio: true, Video: true, Other: true }));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return list.filter(a => !q || a.name.toLowerCase().includes(q));
    }, [list, query]);

    type Cat = 'Images' | 'Audio' | 'Video' | 'Other';
    const grouped = useMemo(() => {
        const map = new Map<Cat, typeof filtered>();
        for (const a of filtered) {
            let key: Cat = 'Other';
            if (a.type?.startsWith('image/')) key = 'Images';
            else if (a.type?.startsWith('audio/')) key = 'Audio';
            else if (a.type?.startsWith('video/')) key = 'Video';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(a);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    return (
        <div className="mt-2">
            {!hideHeader && (
                <div className="flex items-center justify-between mb-2 text-sm font-medium">Assets</div>
            )}
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
                                        <AssetItem key={a.hash} hash={a.hash} name={a.name} onRemove={() => remove(a.hash)} onSync={user ? () => syncToCloud(a.hash) : undefined} syncing={!!syncing[a.hash]} setSyncing={(v: boolean) => setSyncing(s => ({ ...s, [a.hash]: v }))} getUrl={getUrl} cloudUrl={a.cloudUrl} />
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

function AssetItem({ hash, name, onRemove, onSync, syncing, setSyncing, getUrl, cloudUrl }: {
    hash: string;
    name: string;
    onRemove: () => Promise<void>;
    onSync?: () => Promise<unknown>;
    syncing: boolean;
    setSyncing: (v: boolean) => void;
    getUrl: (hash: string) => Promise<string | null>;
    cloudUrl?: string;
}) {
    const [url, setUrl] = useState<string | null>(null);
    React.useEffect(() => { let alive = true; getUrl(hash).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [hash, getUrl]);
    return (
        <div
            className="border border-[color:var(--border)] rounded-md overflow-hidden"
            draggable
            onDragStart={(e) => {
                // Provide custom and fallback types for easiest integration
                try { e.dataTransfer.setData('application/x-asset-hash', hash); } catch { /* ignore */ }
                try { e.dataTransfer.setData('text/asset-hash', hash); } catch { /* ignore */ }
                try { e.dataTransfer.setData('text/plain', `asset://${hash}`); } catch { /* ignore */ }
            }}
            title="Drag onto an Image widget to set its source"
        >
            <div className="w-full aspect-square bg-[color:var(--muted)]/40 flex items-center justify-center overflow-hidden">
                {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : <div className="text-[10px] text-[color:var(--fg-muted)]">Loading…</div>}
            </div>
            <div className="p-2 text-[11px] flex items-center justify-between gap-2">
                <div className="truncate" title={name}>{name}</div>
                <div className="flex items-center gap-1">
                    {onSync && (
                        <button className="btn btn-ghost btn-xxs" title={cloudUrl ? 'Synced' : 'Sync to cloud'} aria-label={cloudUrl ? 'Synced' : 'Sync to cloud'} onClick={async () => { if (syncing) return; setSyncing(true); try { await onSync(); } finally { setSyncing(false); } }} disabled={syncing}>
                            <CloudUpload size={12} />
                        </button>
                    )}
                    <button className="btn btn-ghost btn-xxs" title="Delete asset" aria-label="Delete asset" onClick={onRemove}>
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
