import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';

import { AssetMeta, computeHash, getImageSize, idbAllMeta, idbDelete, idbGet, idbPut, stores } from '../lib/assetsStore';
import { auth, storage } from '../lib/firebase';

import { useNotifications } from './NotificationsProvider';
import { useProjects, buildProjectAssetPath } from './ProjectsProvider';

export type AssetsCtx = {
    list: AssetMeta[];
    addFiles: (files: FileList | File[] | null) => Promise<AssetMeta[]>;
    getUrl: (hash: string) => Promise<string | null>; // object URL for preview
    remove: (hash: string) => Promise<void>;
    syncToCloud: (hash: string) => Promise<AssetMeta | null>;
    get: (hash: string) => Promise<AssetMeta | null>;
    syncAllToCloud: () => Promise<AssetMeta[]>;
    ensure: (hash: string) => Promise<AssetMeta | null>; // ensure blob present locally (download if needed)
};

const Ctx = createContext<AssetsCtx | null>(null);


export function AssetsProvider({ children }: { children: React.ReactNode }) {
    const [list, setList] = useState<AssetMeta[]>([]);
    const urlsRef = useRef<Record<string, string>>({});
    const { add: notify } = useNotifications();
    const { selectedProject, projects } = useProjects();
    const LARGE_IMAGE_THRESHOLD = 2 * 1024 * 1024; // 2MB
    function formatBytes(bytes: number) {
        if (bytes < 1024) return bytes + ' B';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(2)} MB`;
    }

    const refresh = useCallback(async () => {
        const items = await idbAllMeta();
        // Only show assets that belong to the currently selected project
        const pid = selectedProject?.id ?? null;
        console.info('AssetsProvider.refresh: pid=', pid, 'totalAssets=', items.length);
        if (pid) {
            setList(items.filter(it => it.projectId === pid));
            console.info('AssetsProvider.refresh: matched=', items.filter(it => it.projectId === pid).length);
        } else {
            // If no project selected, show no assets
            setList([]);
        }
    }, [selectedProject?.id]);

    useEffect(() => { void refresh(); }, [refresh]);

    const addFiles = useCallback(async (files: FileList | File[] | null) => {
        const results: AssetMeta[] = [];
        if (!files || (Array.isArray(files) && files.length === 0) || ('length' in (files as FileList) && (files as FileList).length === 0)) return results;
        const arr = Array.from(files as File[]);
        console.info('AssetsProvider.addFiles: selectedProjectId=', selectedProject?.id, 'fileCount=', arr.length);
        for (const file of arr) {
            const hash = await computeHash(file);
            const existing = await idbGet<AssetMeta>(stores.STORE_META, hash);
            if (existing) {
                // If an existing meta exists but isn't attached to the current project,
                // attach it so it's visible in the current project's Assets list.
                const currentPid = selectedProject?.id ?? undefined;
                if (currentPid && existing.projectId !== currentPid) {
                    const patched: AssetMeta = { ...existing, projectId: currentPid };
                    try { await idbPut(stores.STORE_META, hash, patched); results.push(patched); continue; } catch { /* ignore */ }
                }
                results.push(existing);
                continue;
            }
            const dim = await getImageSize(file);
            const meta: AssetMeta = {
                hash,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                width: dim.width,
                height: dim.height,
                createdAt: new Date().toISOString(),
                projectId: selectedProject?.id,
            };
            // Notify if image is large
            try {
                if (file.size > LARGE_IMAGE_THRESHOLD) {
                    notify({ type: 'warning', message: `Large image detected: ${file.name} (${formatBytes(file.size)})`, title: selectedProject?.name, persistent: false });
                }
            } catch { /* ignore notification failures */ }
            await idbPut(stores.STORE_BLOBS, hash, file);
            // Persist meta; ensure we attach the current selected project id at write time
            try {
                const pid = selectedProject?.id ?? meta.projectId ?? undefined;
                const nextMeta = { ...meta, projectId: pid };
                await idbPut(stores.STORE_META, hash, nextMeta);
                results.push(nextMeta);
            } catch {
                // Fallback: write original meta and continue
                await idbPut(stores.STORE_META, hash, meta);
                results.push(meta);
            }
        }
        await refresh();
        console.info('AssetsProvider.addFiles: stored assets', results.map(r => ({ hash: r.hash, projectId: r.projectId, cloudUrl: r.cloudUrl })));
        // Auto-sync to cloud if this is a cloud project
        try {
            const isCloudProject = !!(selectedProject as unknown as { _cloudId?: string })?._cloudId;
            const user = auth.currentUser;
            if (isCloudProject && user && results.length) {
                for (const m of results) {
                    void (async () => {
                        try {
                            await syncToCloud(m.hash);
                        } catch (err) {
                            console.warn('Automatic syncToCloud failed for asset', m.hash, err);
                        }
                    })();
                }
            }
        } catch (err) { /* ignore */ }
        return results;
    }, [refresh, selectedProject?.id]);

    const getUrl = useCallback(async (hash: string) => {
        if (urlsRef.current[hash]) return urlsRef.current[hash];
        let blob = await idbGet<Blob>(stores.STORE_BLOBS, hash);
        if (!blob) {
            // Try to fetch the blob from cloud and store locally
            try {
                const meta = await idbGet<AssetMeta>(stores.STORE_META, hash);
                if (meta?.cloudUrl) {
                    const resp = await fetch(meta.cloudUrl);
                    if (resp.ok) {
                        blob = await resp.blob();
                        await idbPut(stores.STORE_BLOBS, hash, blob);
                    }
                }
            } catch { /* ignore */ }
        }
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urlsRef.current[hash] = url;
        return url;
    }, []);

    const remove = useCallback(async (hash: string) => {
        try { if (urlsRef.current[hash]) { URL.revokeObjectURL(urlsRef.current[hash]); delete urlsRef.current[hash]; } } catch { /* noop */ }
        await idbDelete(stores.STORE_BLOBS, hash);
        await idbDelete(stores.STORE_META, hash);
        await refresh();
    }, [refresh]);

    const syncToCloud = useCallback(async (hash: string): Promise<AssetMeta | null> => {
        const user = auth.currentUser; if (!user) return null;
        let meta = await idbGet<AssetMeta>(stores.STORE_META, hash); if (!meta) return null;
        const blob = await idbGet<Blob>(stores.STORE_BLOBS, hash); if (!blob) return null;
        let projectId = meta.projectId;
        if (!projectId && selectedProject?.id) {
            projectId = selectedProject.id;
            const patched: AssetMeta = { ...meta, projectId };
            try { await idbPut(stores.STORE_META, hash, patched); meta = patched; } catch { /* ignore */ }
        }
        if (!projectId) {
            try { notify({ type: 'error', title: selectedProject?.name, message: 'Select a portfolio before syncing assets to the cloud.', persistent: false }); } catch { /* noop */ }
            return meta;
        }
        // Ensure selectedProject ownership when syncing to cloud; only the owner can upload assets to the project's cloud path
        try {
            const proj = projects?.find(p => p.id === projectId);
            if (proj && typeof proj.ownerUid === 'string' && proj.ownerUid !== user.uid) {
                try { notify({ type: 'error', title: proj.name, message: 'Unable to sync assets: you are not the owner of this cloud project.', persistent: false }); } catch { /* noop */ }
                console.warn('syncToCloud: user is not owner of project', { projectId, ownerUid: proj.ownerUid, currentUid: user.uid });
                return meta;
            }
        } catch { /* ignore */ }
        const path = buildProjectAssetPath(user.uid, projectId, hash);
        console.info('syncToCloud: uploading asset', { hash, projectId, path });
        try {
            // Try to get an existing URL (dedupe)
            let url: string | null = null;
            try { url = await getDownloadURL(storageRef(storage, path)); } catch { url = null; }
            if (!url) {
                await uploadBytes(storageRef(storage, path), blob, { contentType: meta.type });
                url = await getDownloadURL(storageRef(storage, path));
            }
            const next: AssetMeta = { ...meta, cloudPath: path, cloudUrl: url || undefined, syncedAt: new Date().toISOString() };
            await idbPut(stores.STORE_META, hash, next);
            await refresh();
            try { notify({ type: 'success', title: selectedProject?.name, message: 'Asset uploaded to cloud', persistent: false }); } catch { /* noop */ }
            console.info('syncToCloud: upload complete', { hash, cloudUrl: url });
            return next;
        } catch {
            return meta;
        }
    }, [notify, refresh, selectedProject?.id, selectedProject?.name]);

    const syncAllToCloud = useCallback(async () => {
        const user = auth.currentUser; if (!user) return [];
        const metas = await idbAllMeta();
        const toSync = metas.filter(m => !m.cloudUrl || !m.syncedAt);
        const results: AssetMeta[] = [];
        for (const m of toSync) {
            const synced = await syncToCloud(m.hash);
            if (synced) results.push(synced);
        }
        return results;
    }, [syncToCloud]);

    const ensure = useCallback(async (hash: string) => {
        const meta = await idbGet<AssetMeta>(stores.STORE_META, hash); if (!meta) return null;
        const existingBlob = await idbGet<Blob>(stores.STORE_BLOBS, hash);
        if (existingBlob) return meta;
        // Attempt remote fetch if we have a cloud URL
        if (meta.cloudUrl) {
            try {
                const resp = await fetch(meta.cloudUrl);
                if (resp.ok) {
                    const blob = await resp.blob();
                    await idbPut(stores.STORE_BLOBS, hash, blob);
                    return meta;
                }
            } catch { /* noop */ }
        }
        return meta; // return meta even if blob missing
    }, []);

    // Auto bulk sync on sign-in
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) { void syncAllToCloud(); }
        });
        return () => unsub();
    }, [syncAllToCloud]);

    const get = useCallback(async (hash: string) => {
        const meta = (await idbGet<AssetMeta>(stores.STORE_META, hash)) || null;
        // If a meta exists but isn't associated with the current project, attach it now
        try {
            const pid = selectedProject?.id;
            if (meta && !meta.projectId && pid) {
                const next: AssetMeta = { ...meta, projectId: pid };
                await idbPut(stores.STORE_META, hash, next);
                return next;
            }
        } catch { /* ignore */ }
        return meta;
    }, [selectedProject?.id]);

    const api = useMemo<AssetsCtx>(() => ({ list, addFiles, getUrl, remove, syncToCloud, get, syncAllToCloud, ensure }), [list, addFiles, getUrl, remove, syncToCloud, get, syncAllToCloud, ensure]);
    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAssets() {
    const v = useContext(Ctx); if (!v) throw new Error('useAssets outside provider'); return v;
}
