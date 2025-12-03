const FALLBACK_PROJECT_ID = '__local__';

export type PreviewStateSnapshot = {
    running: boolean;
    localUrl?: string | null;
    lanUrl?: string | null;
};

type PreviewStateStore = Record<string, PreviewStateSnapshot>;
type PreviewLogStore = Record<string, string[]>;

type MaybeWindow = typeof window | undefined;

function safeWindow(): MaybeWindow {
    return typeof window === 'undefined' ? undefined : window;
}

function resolveKey(projectId?: string | null): string {
    return projectId || FALLBACK_PROJECT_ID;
}

function ensureLogStore(): PreviewLogStore | undefined {
    const win = safeWindow() as any;
    if (!win) return undefined;
    const existing = win.__py_preview_log;
    if (!existing || typeof existing !== 'object') {
        const store: PreviewLogStore = Object.create(null);
        win.__py_preview_log = store;
        return store;
    }
    if (Array.isArray(existing)) {
        const store: PreviewLogStore = { [FALLBACK_PROJECT_ID]: existing.slice() };
        win.__py_preview_log = store;
        return store;
    }
    return existing as PreviewLogStore;
}

function ensureStateStore(): PreviewStateStore | undefined {
    const win = safeWindow() as any;
    if (!win) return undefined;
    const existing = win.__py_preview_state;
    if (!existing || typeof existing !== 'object') {
        const store: PreviewStateStore = Object.create(null);
        win.__py_preview_state = store;
        return store;
    }
    if (typeof existing.running === 'boolean') {
        const snapshot = { ...existing } as PreviewStateSnapshot;
        const store: PreviewStateStore = { [FALLBACK_PROJECT_ID]: snapshot };
        win.__py_preview_state = store;
        return store;
    }
    return existing as PreviewStateStore;
}

export function getPreviewLog(projectId?: string | null): string[] {
    const store = ensureLogStore();
    if (!store) return [];
    const key = resolveKey(projectId);
    const bucket = store[key];
    return Array.isArray(bucket) ? [...bucket] : [];
}

export function replacePreviewLog(projectId: string | null | undefined, lines: string[]): void {
    const store = ensureLogStore();
    if (!store) return;
    store[resolveKey(projectId)] = [...lines];
}

export function clearPreviewLog(projectId: string | null | undefined): void {
    const store = ensureLogStore();
    if (!store) return;
    store[resolveKey(projectId)] = [];
}

export function appendPreviewLog(projectId: string | null | undefined, line: string): void {
    const store = ensureLogStore();
    if (!store) return;
    const key = resolveKey(projectId);
    const bucket = store[key] || [];
    bucket.push(line);
    store[key] = bucket;
}

export function getPreviewState(projectId?: string | null): PreviewStateSnapshot | null {
    const store = ensureStateStore();
    if (!store) return null;
    const snapshot = store[resolveKey(projectId)];
    return snapshot ? { ...snapshot } : null;
}

export function setPreviewState(projectId: string | null | undefined, state: PreviewStateSnapshot): void {
    const store = ensureStateStore();
    if (!store) return;
    store[resolveKey(projectId)] = { ...state };
}

export function clearPreviewState(projectId: string | null | undefined): void {
    const store = ensureStateStore();
    if (!store) return;
    delete store[resolveKey(projectId)];
}
