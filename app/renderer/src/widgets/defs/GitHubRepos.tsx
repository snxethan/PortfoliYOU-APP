import React, { useMemo, useState, useEffect, useRef, useId } from 'react';
import { z } from 'zod';
import { GitBranch, RefreshCw, Star } from 'lucide-react';

import type { WidgetDefinition } from '../types';
import { useWidget } from '../sdk';
import {
    clampRepoCount,
    clearLocalCache,
    GITHUB_CACHE_TTL_MS,
    getRequestedMax,
    isCacheFresh,
    pickNewestCache,
    readLocalCache,
    RepoCacheEntry,
    RepoPreview,
    takeRepoPreview,
    writeLocalCache,
    normalizeUsername,
} from '../utils/githubRepos';
import { FOCUS_RING, SR_ONLY } from '../utils/a11y';

const LAYOUTS = ['cards', 'list'] as const;
type Layout = (typeof LAYOUTS)[number];

const FALLBACK_USERNAME = 'vercel';
const DEFAULT_MAX_ITEMS = 6;

class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

type GitHubReposProps = {
    username: string;
    maxItems?: number;
    layout?: Layout;
    cachedRepos?: RepoPreview[];
    cachedFetchedAt?: number;
    cachedMaxItems?: number;
    ariaLabel?: string;
    ariaDescription?: string;
    announceMode?: 'off' | 'polite' | 'assertive';
    refreshLabel?: string;
    containerBackgroundColor?: string;
    cardBackgroundColor?: string;
    cardBorderColor?: string;
    cardTextColor?: string;
    cardMutedColor?: string;
};

type RepoCardAppearance = {
    background?: string;
    border?: string;
    text?: string;
    muted?: string;
};

type GitHubWidgetPalette = {
    containerBackground?: string;
    card: RepoCardAppearance;
};

function normalizeColor(value?: string): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function GitHubReposView(props: GitHubReposProps) {
    const { editing, updateProps } = useWidget();
    const sectionId = useId();
    const providedUsername = normalizeUsername(props.username);
    const isSampleUser = !providedUsername;
    const username = providedUsername || FALLBACK_USERNAME;
    const layout: Layout = LAYOUTS.includes((props.layout as Layout)) ? (props.layout as Layout) : 'cards';
    const maxItems = clampRepoCount(props.maxItems ?? DEFAULT_MAX_ITEMS);
    const propCache = useMemo<RepoCacheEntry | null>(() => {
        if (!props.cachedRepos || typeof props.cachedFetchedAt !== 'number') return null;
        if (!Array.isArray(props.cachedRepos) || props.cachedRepos.length === 0) return null;
        return {
            username: username.toLowerCase(),
            fetchedAt: props.cachedFetchedAt,
            repos: props.cachedRepos,
            requestedMax: typeof props.cachedMaxItems === 'number' ? props.cachedMaxItems : props.cachedRepos.length,
        };
    }, [props.cachedFetchedAt, props.cachedRepos, props.cachedMaxItems, username]);

    const initialCache = useMemo(() => {
        const stored = readLocalCache(username.toLowerCase());
        return pickNewestCache(propCache, stored);
    }, [propCache, username]);

    const [cache, setCache] = useState<RepoCacheEntry | null>(initialCache);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimited, setRateLimited] = useState(false);

    const [refreshToken, setRefreshToken] = useState(0);
    const appliedRefreshRef = useRef(0);

    useEffect(() => {
        const stored = readLocalCache(username.toLowerCase());
        const next = pickNewestCache(propCache, stored);
        setCache(next);
        setError(null);
        setRateLimited(false);
    }, [propCache, username]);

    useEffect(() => {
        let cancelled = false;
        const normalizedUser = username.toLowerCase();
        const cachedRequest = getRequestedMax(cache);
        const needsMoreItems = !cache || cachedRequest < maxItems;
        const stale = !isCacheFresh(cache);
        const manualRefreshRequested = refreshToken !== appliedRefreshRef.current;
        if (!needsMoreItems && !stale && !manualRefreshRequested) {
            return;
        }
        appliedRefreshRef.current = refreshToken;
        let controller: AbortController | null = null;
        async function fetchRepos() {
            setLoading(true);
            setError(null);
            setRateLimited(false);
            controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            try {
                const repos = await requestGitHubRepos(normalizedUser, maxItems, controller?.signal ?? undefined);
                if (cancelled) return;
                const entry: RepoCacheEntry = { username: normalizedUser, fetchedAt: Date.now(), repos, requestedMax: maxItems };
                setCache(entry);
                setLoading(false);
                setError(null);
                setRateLimited(false);
                writeLocalCache(entry);
                if (editing) {
                    updateProps({ cachedRepos: entry.repos, cachedFetchedAt: entry.fetchedAt, cachedMaxItems: maxItems });
                }
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                if (err instanceof RateLimitError) {
                    setLoading(false);
                    setRateLimited(true);
                    setError('GitHub rate limit hit. Showing cached data when available.');
                    return;
                }
                if (err instanceof NotFoundError) {
                    setCache(null);
                    setLoading(false);
                    setRateLimited(false);
                    setError(err.message);
                    if (editing) {
                        updateProps({ cachedRepos: undefined, cachedFetchedAt: undefined, cachedMaxItems: undefined });
                        clearLocalCache(normalizedUser);
                    }
                    return;
                }
                const message = err instanceof Error ? err.message : 'Failed to load repositories.';
                setLoading(false);
                setError(message);
                setRateLimited(false);
            }
        }
        void fetchRepos();
        return () => {
            cancelled = true;
            controller?.abort();
        };
    }, [cache, editing, maxItems, refreshToken, updateProps, username]);

    const repos = useMemo(() => {
        const source = cache?.repos || [];
        return source.slice(0, maxItems);
    }, [cache, maxItems]);

    const lastUpdated = cache?.fetchedAt ? new Date(cache.fetchedAt) : null;
    const showPlaceholder = repos.length === 0 && !loading;

    const statusText = (() => {
        if (loading) return 'Loading repositories…';
        if (error) return error;
        if (rateLimited) return 'GitHub rate limit hit; cached data shown.';
        if (isSampleUser) return 'Using sample data. Open the widget settings to add your GitHub username.';
        return lastUpdated ? `Showing cached data from ${lastUpdated.toLocaleString()}` : 'Repositories will appear here once loaded.';
    })();

    const cacheMinutes = Math.round(GITHUB_CACHE_TTL_MS / 60000);
    const headingId = `${sectionId}-heading`;
    const descriptionId = props.ariaDescription ? `${sectionId}-desc` : undefined;
    const regionLabel = props.ariaLabel || 'GitHub repositories';
    const announceMode = props.announceMode || 'polite';
    const shouldAnnounce = announceMode !== 'off';
    const refreshLabel = props.refreshLabel || 'Refresh repositories';
    const palette = useMemo<GitHubWidgetPalette>(() => {
        const containerBackground = normalizeColor(props.containerBackgroundColor);
        const cardBackground = normalizeColor(props.cardBackgroundColor);
        const cardBorder = normalizeColor(props.cardBorderColor);
        const cardText = normalizeColor(props.cardTextColor);
        const cardMuted = normalizeColor(props.cardMutedColor);
        return {
            containerBackground,
            card: {
                background: cardBackground,
                border: cardBorder,
                text: cardText,
                muted: cardMuted,
            },
        };
    }, [
        props.cardBackgroundColor,
        props.cardBorderColor,
        props.cardMutedColor,
        props.cardTextColor,
        props.containerBackgroundColor,
    ]);
    const sectionStyle = palette.containerBackground ? { background: palette.containerBackground } : undefined;

    return (
        <section
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            aria-label={regionLabel}
            role="region"
            className="flex h-full w-full min-h-0 flex-col gap-3 p-3"
            style={sectionStyle}
            data-widget-role="github-repos"
        >
            <header className="flex items-center justify-between gap-2">
                <div>
                    <div id={headingId} className="text-sm font-semibold text-[color:var(--fg)] flex items-center gap-2">
                        <GitBranch size={16} aria-hidden="true" />
                        @{username}
                    </div>
                    <p className="text-xs text-[color:var(--fg-muted)]">
                        {isSampleUser ? 'Sample profile shown until you set a username' : `Latest public repositories (cached for ${cacheMinutes} min)`}
                    </p>
                    {props.ariaDescription && (
                        <p id={descriptionId} className={SR_ONLY}>{props.ariaDescription}</p>
                    )}
                </div>
                <button
                    type="button"
                    className={`btn btn-outline btn-xs ${FOCUS_RING}`}
                    onClick={() => setRefreshToken((prev) => prev + 1)}
                    disabled={loading}
                    aria-label={refreshLabel}
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                    <span className="ml-1">Refresh</span>
                </button>
            </header>
            <div
                role="list"
                aria-label="Repository list"
                className={`flex-1 min-h-0 overflow-auto scrollable scrollable-container ${layout === 'cards' ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'flex flex-col gap-2'}`}
            >
                {loading && repos.length === 0 ? (
                    <SkeletonList layout={layout} count={maxItems} />
                ) : showPlaceholder ? (
                    <Placeholder message={statusText} />
                ) : (
                    repos.map((repo) => (
                        <RepoCard key={repo.id} repo={repo} layout={layout} appearance={palette.card} />
                    ))
                )}
            </div>
            <footer className="text-[10px] text-[color:var(--fg-muted)] flex items-center justify-between gap-2">
                <span role="status" aria-live={shouldAnnounce ? announceMode : undefined}>
                    {statusText}
                </span>
                {lastUpdated && (
                    <span>Last updated {timeAgo(lastUpdated)}</span>
                )}
            </footer>
        </section>
    );
}

function Placeholder({ message }: { message: string }) {
    return (
        <div className="flex h-full flex-1 items-center justify-center rounded border border-dashed border-[color:var(--border)] text-center text-xs text-[color:var(--fg-muted)]">
            {message}
        </div>
    );
}

function RepoCard({ repo, layout, appearance }: { repo: RepoPreview; layout: Layout; appearance: RepoCardAppearance }) {
    const cardStyle: React.CSSProperties = {};
    if (appearance.background) cardStyle.background = appearance.background;
    if (appearance.border) cardStyle.borderColor = appearance.border;
    const headingStyle = appearance.text ? { color: appearance.text } : undefined;
    const mutedStyle = appearance.muted ? { color: appearance.muted } : undefined;
    const badgeStyle: React.CSSProperties = {};
    if (appearance.text) badgeStyle.color = appearance.text;
    if (appearance.border) badgeStyle.borderColor = appearance.border;
    return layout === 'cards' ? (
        <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            role="listitem"
            className={`flex flex-col gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${FOCUS_RING}`}
            style={cardStyle}
        >
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[color:var(--fg)]" style={headingStyle}>{repo.name}</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]" style={badgeStyle}>
                    <Star size={10} aria-hidden="true" /> {repo.stars}
                </span>
            </div>
            {repo.description && <p className="text-sm text-[color:var(--fg-muted)]" style={mutedStyle}>{repo.description}</p>}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--fg-muted)]" style={mutedStyle}>
                {repo.language && <span>{repo.language}</span>}
                <span>Updated {timeAgo(new Date(repo.updatedAt))}</span>
            </div>
        </a>
    ) : (
        <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            role="listitem"
            className={`flex items-center justify-between gap-3 rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm ${FOCUS_RING}`}
            style={cardStyle}
        >
            <div>
                <div className="font-medium text-[color:var(--fg)]" style={headingStyle}>{repo.name}</div>
                <div className="text-[11px] text-[color:var(--fg-muted)]" style={mutedStyle}>Updated {timeAgo(new Date(repo.updatedAt))}</div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs text-[color:var(--fg-muted)]" style={mutedStyle}>
                <Star size={12} aria-hidden="true" /> {repo.stars}
            </div>
        </a>
    );
}

function SkeletonList({ layout, count }: { layout: Layout; count: number }) {
    return (
        <div className={layout === 'cards' ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'flex flex-col gap-2'}>
            {Array.from({ length: Math.min(count, 6) }).map((_, idx) => (
                <div key={idx} className="animate-pulse rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-4" />
            ))}
        </div>
    );
}

function timeAgo(date: Date): string {
    const now = Date.now();
    const diff = date.getTime() - now;
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const absMinutes = Math.round(Math.abs(diff) / 60000);
    if (absMinutes < 60) {
        return rtf.format(Math.round(diff / 60000), 'minute');
    }
    const absHours = Math.round(Math.abs(diff) / 3600000);
    if (absHours < 24) {
        return rtf.format(Math.round(diff / 3600000), 'hour');
    }
    return rtf.format(Math.round(diff / 86400000), 'day');
}

async function requestGitHubRepos(username: string, maxItems: number, signal?: AbortSignal): Promise<RepoPreview[]> {
    if (!username) return [];
    const perPage = Math.min(maxItems, 30);
    const endpoint = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&sort=updated`;
    const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'PortfoliYOU-App',
        },
        signal,
    });
    if (res.status === 404) {
        throw new NotFoundError('GitHub user not found. Check the username.');
    }
    if (res.status === 403) {
        throw new RateLimitError('GitHub API rate limit exceeded');
    }
    if (!res.ok) {
        throw new Error(`GitHub request failed (${res.status})`);
    }
    const body = (await res.json()) as Array<Record<string, unknown>>;
    return takeRepoPreview(body, maxItems);
}

const schema = z
    .object({
        username: z.string().min(1, 'Username is required').max(39, 'GitHub usernames are up to 39 characters'),
        maxItems: z.number().min(1).max(30).optional(),
        layout: z.enum(['cards', 'list']).optional(),
        ariaLabel: z.string().max(160).optional(),
        ariaDescription: z.string().max(400).optional(),
        announceMode: z.enum(['off', 'polite', 'assertive']).optional(),
        refreshLabel: z.string().max(80).optional(),
        containerBackgroundColor: z.string().max(120).optional(),
        cardBackgroundColor: z.string().max(120).optional(),
        cardBorderColor: z.string().max(120).optional(),
        cardTextColor: z.string().max(120).optional(),
        cardMutedColor: z.string().max(120).optional(),
    })
    .passthrough();

const def: WidgetDefinition<GitHubReposProps> = {
    type: 'github-repos',
    label: 'GitHub Repos',
    version: 1,
    defaultProps: {
        username: FALLBACK_USERNAME,
        maxItems: DEFAULT_MAX_ITEMS,
        layout: 'cards',
        ariaLabel: 'GitHub repositories',
        ariaDescription: 'Repository list fetched from GitHub. Use Enter to open a repo in a new tab.',
        announceMode: 'polite',
        refreshLabel: 'Refresh repositories',
    },
    grid: { w: 6, h: 6 },
    render: (props) => <GitHubReposView {...props} />,
    zodSchema: schema,
};

export default def;
