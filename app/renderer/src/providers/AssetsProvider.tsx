import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth, storage } from '../lib/firebase';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import { AssetMeta, computeHash, getImageSize, idbAllMeta, idbDelete, idbGet, idbPut, stores } from '../lib/assetsStore';

export type AssetsCtx = {
    list: AssetMeta[];
    addFiles: (files: FileList | File[] | null) => Promise<AssetMeta[]>;
    getUrl: (hash: string) => Promise<string | null>; // object URL for preview
    remove: (hash: string) => Promise<void>;
    syncToCloud: (hash: string) => Promise<AssetMeta | null>;
    get: (hash: string) => Promise<AssetMeta | null>;
};

const Ctx = createContext<AssetsCtx | null>(null);


export function AssetsProvider({ children }: { children: React.ReactNode }) {
    const [list, setList] = useState<AssetMeta[]>([]);
    const urlsRef = useRef<Record<string, string>>({});

    const refresh = useCallback(async () => {
        const items = await idbAllMeta();
        setList(items);
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const addFiles = useCallback(async (files: FileList | File[] | null) => {
        const results: AssetMeta[] = [];
        if (!files || (Array.isArray(files) && files.length === 0) || ('length' in (files as FileList) && (files as FileList).length === 0)) return results;
        const arr = Array.from(files as File[]);
        for (const file of arr) {
            const hash = await computeHash(file);
            const existing = await idbGet<AssetMeta>(stores.STORE_META, hash);
            if (existing) { results.push(existing); continue; }
            const dim = await getImageSize(file);
            const meta: AssetMeta = {
                hash,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                width: dim.width,
                height: dim.height,
                createdAt: new Date().toISOString(),
            };
            await idbPut(stores.STORE_BLOBS, hash, file);
            await idbPut(stores.STORE_META, hash, meta);
            results.push(meta);
        }
        await refresh();
        return results;
    }, [refresh]);

    const getUrl = useCallback(async (hash: string) => {
        if (urlsRef.current[hash]) return urlsRef.current[hash];
        const blob = await idbGet<Blob>(stores.STORE_BLOBS, hash);
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
        const meta = await idbGet<AssetMeta>(stores.STORE_META, hash); if (!meta) return null;
        const blob = await idbGet<Blob>(stores.STORE_BLOBS, hash); if (!blob) return null;
        const path = `users/${user.uid}/assets/${hash}`;
        try {
            // Try to get an existing URL (dedupe)
            let url: string | null = null;
            try { url = await getDownloadURL(storageRef(storage, path)); } catch { url = null; }
            if (!url) {
                await uploadBytes(storageRef(storage, path), blob, { contentType: meta.type });
                url = await getDownloadURL(storageRef(storage, path));
            }
            const next: AssetMeta = { ...meta, cloudPath: path, cloudUrl: url || undefined };
            await idbPut(stores.STORE_META, hash, next);
            await refresh();
            return next;
        } catch {
            return meta;
        }
    }, [refresh]);

    const get = useCallback(async (hash: string) => {
        return (await idbGet<AssetMeta>(stores.STORE_META, hash)) || null;
    }, []);

    const api = useMemo<AssetsCtx>(() => ({ list, addFiles, getUrl, remove, syncToCloud, get }), [list, addFiles, getUrl, remove, syncToCloud, get]);
    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAssets() {
    const v = useContext(Ctx); if (!v) throw new Error('useAssets outside provider'); return v;
}
