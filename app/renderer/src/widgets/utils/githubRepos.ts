export type RepoPreview = {
    id: number;
    name: string;
    description?: string;
    stars: number;
    url: string;
    language?: string;
    updatedAt: string;
};

export type RepoCacheEntry = {
    username: string;
    fetchedAt: number;
    repos: RepoPreview[];
    requestedMax?: number;
};

export const GITHUB_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_PREFIX = 'py_github_cache:';
const FALLBACK_MAX_ITEMS = 6;
const MAX_ALLOWED_ITEMS = 30;

export function clampRepoCount(value?: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_MAX_ITEMS;
    if (!Number.isFinite(value)) return FALLBACK_MAX_ITEMS;
    const int = Math.round(value);
    if (int < 1) return 1;
    if (int > MAX_ALLOWED_ITEMS) return MAX_ALLOWED_ITEMS;
    return int;
}

export function normalizeUsername(input?: string): string {
    return (input ?? '').trim();
}

export function isCacheFresh(entry: RepoCacheEntry | null | undefined, now = Date.now()): boolean {
    if (!entry) return false;
    if (!entry.fetchedAt || !Array.isArray(entry.repos)) return false;
    return now - entry.fetchedAt <= GITHUB_CACHE_TTL_MS;
}

export function pickNewestCache(...entries: Array<RepoCacheEntry | null | undefined>): RepoCacheEntry | null {
    return entries
        .filter((entry): entry is RepoCacheEntry => !!entry && Array.isArray(entry.repos) && typeof entry.fetchedAt === 'number')
        .sort((a, b) => b.fetchedAt - a.fetchedAt)[0] || null;
}

export function getRequestedMax(entry?: RepoCacheEntry | null): number {
    if (!entry) return 0;
    if (typeof entry.requestedMax === 'number' && entry.requestedMax > 0) return entry.requestedMax;
    return Array.isArray(entry.repos) ? entry.repos.length : 0;
}

export function readLocalCache(username: string): RepoCacheEntry | null {
    if (!username) return null;
    try {
        const storage = getStorage();
        if (!storage) return null;
        const key = CACHE_PREFIX + username.toLowerCase();
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RepoCacheEntry;
        if (!Array.isArray(parsed?.repos) || typeof parsed.fetchedAt !== 'number') return null;
        return parsed;
    } catch {
        return null;
    }
}

export function writeLocalCache(entry: RepoCacheEntry) {
    try {
        const storage = getStorage();
        if (!storage) return;
        const key = CACHE_PREFIX + entry.username.toLowerCase();
        storage.setItem(key, JSON.stringify(entry));
    } catch {
        /* ignore */
    }
}

export function clearLocalCache(username: string) {
    try {
        const storage = getStorage();
        if (!storage) return;
        storage.removeItem(CACHE_PREFIX + username.toLowerCase());
    } catch {
        /* ignore */
    }
}

type GitHubApiRepo = {
    id?: number;
    name?: string;
    description?: string;
    stargazers_count?: number;
    html_url?: string;
    language?: string;
    updated_at?: string;
};

export function mapApiRepo(raw: GitHubApiRepo): RepoPreview | null {
    if (!raw || typeof raw.id !== 'number' || !raw.name || !raw.html_url) return null;
    const updated = typeof raw.updated_at === 'string' && raw.updated_at ? raw.updated_at : new Date().toISOString();
    return {
        id: raw.id,
        name: raw.name,
        description: raw.description?.trim() || undefined,
        stars: typeof raw.stargazers_count === 'number' && raw.stargazers_count > 0 ? raw.stargazers_count : 0,
        url: raw.html_url,
        language: raw.language?.trim() || undefined,
        updatedAt: updated,
    };
}

export function takeRepoPreview(list: GitHubApiRepo[], limit: number): RepoPreview[] {
    const previews: RepoPreview[] = [];
    for (const raw of list) {
        const mapped = mapApiRepo(raw);
        if (mapped) {
            previews.push(mapped);
            if (previews.length >= limit) break;
        }
    }
    return previews;
}

function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export const GitHubCacheUtils = {
    clampRepoCount,
    normalizeUsername,
    isCacheFresh,
    pickNewestCache,
    getRequestedMax,
    readLocalCache,
    writeLocalCache,
    clearLocalCache,
    mapApiRepo,
    takeRepoPreview,
};
