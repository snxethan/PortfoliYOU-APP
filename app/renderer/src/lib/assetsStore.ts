// Shared asset storage for renderer (IndexedDB)
// Provides hash computation, blob/meta persistence and listing.

export type AssetMeta = {
    hash: string;
    name: string;
    type: string;
    size: number;
    width?: number;
    height?: number;
    createdAt: string; // ISO
    cloudPath?: string;
    cloudUrl?: string;
    syncedAt?: string; // ISO timestamp when successfully uploaded to cloud
    projectId?: string; // optional: associate asset with a specific project
};

const DB_NAME = 'py_assets_v1';
const STORE_BLOBS = 'blobs';
const STORE_META = 'meta';

export async function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
            if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbPut(store: string, key: string, value: unknown): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([store], 'readwrite');
        const st = tx.objectStore(store);
        const req = st.put(value as unknown as IDBValidKey, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function idbGet<T = unknown>(store: string, key: string): Promise<T | undefined> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([store], 'readonly');
        const st = tx.objectStore(store);
        const req = st.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function idbDelete(store: string, key: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([store], 'readwrite');
        const st = tx.objectStore(store);
        const req = st.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function idbAllMeta(): Promise<AssetMeta[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['meta'], 'readonly');
        const st = tx.objectStore('meta');
        const items: AssetMeta[] = [];
        const req = st.openCursor();
        req.onsuccess = () => {
            const cursor = req.result as IDBCursorWithValue | null;
            if (!cursor) { resolve(items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))); return; }
            items.push(cursor.value as AssetMeta);
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
}

export async function computeHash(file: Blob): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getImageSize(blob: Blob): Promise<{ width?: number; height?: number }> {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => { const w = img.naturalWidth; const h = img.naturalHeight; URL.revokeObjectURL(url); resolve({ width: w, height: h }); };
            img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
            img.src = url;
        } catch { resolve({}); }
    });
}

export const stores = { DB_NAME, STORE_BLOBS, STORE_META } as const;
