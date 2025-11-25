import { describe, expect, it } from 'vitest';

import {
    clampRepoCount,
    getRequestedMax,
    isCacheFresh,
    mapApiRepo,
    pickNewestCache,
    RepoCacheEntry,
    takeRepoPreview,
    normalizeUsername,
} from '../../../app/renderer/src/widgets/utils/githubRepos';

describe('GitHub repo helpers', () => {
    it('clamps repo count to sane bounds', () => {
        expect(clampRepoCount(undefined)).toBe(6);
        expect(clampRepoCount(0)).toBe(1);
        expect(clampRepoCount(100)).toBe(30);
        expect(clampRepoCount(5.4)).toBe(5);
    });

    it('normalizes usernames by trimming whitespace', () => {
        expect(normalizeUsername('  octocat  ')).toBe('octocat');
        expect(normalizeUsername(undefined)).toBe('');
    });

    it('detects fresh caches within TTL', () => {
        const now = Date.now();
        const entry: RepoCacheEntry = { username: 'dev', fetchedAt: now - 5 * 60 * 1000, repos: [] };
        expect(isCacheFresh(entry, now)).toBe(true);
        const stale: RepoCacheEntry = { username: 'dev', fetchedAt: now - 40 * 60 * 1000, repos: [] };
        expect(isCacheFresh(stale, now)).toBe(false);
    });

    it('picks the newest cache entry', () => {
        const older: RepoCacheEntry = { username: 'dev', fetchedAt: 1_000, repos: [], requestedMax: 3 };
        const newer: RepoCacheEntry = { username: 'dev', fetchedAt: 2_000, repos: [], requestedMax: 6 };
        expect(pickNewestCache(older, newer)).toEqual(newer);
        expect(pickNewestCache(null, undefined)).toBeNull();
    });

    it('returns requested max value when present', () => {
        const entry: RepoCacheEntry = { username: 'dev', fetchedAt: 1_000, repos: [{ id: 1, name: 'a', stars: 0, url: '', updatedAt: '' }], requestedMax: 10 };
        expect(getRequestedMax(entry)).toBe(10);
        expect(getRequestedMax({ username: 'dev', fetchedAt: 2_000, repos: [{ id: 2, name: 'b', stars: 0, url: '', updatedAt: '' }] })).toBe(1);
        expect(getRequestedMax(null)).toBe(0);
    });

    it('maps GitHub API payloads to preview objects', () => {
        const preview = mapApiRepo({
            id: 1,
            name: 'repo',
            html_url: 'https://github.com/octocat/repo',
            description: ' Demo ',
            stargazers_count: 10,
            language: 'TypeScript',
            updated_at: '2025-01-01T00:00:00Z',
        });
        expect(preview).toMatchObject({
            id: 1,
            name: 'repo',
            description: 'Demo',
            stars: 10,
            url: 'https://github.com/octocat/repo',
            language: 'TypeScript',
            updatedAt: '2025-01-01T00:00:00Z',
        });
        expect(mapApiRepo({})).toBeNull();
    });

    it('limits repo previews to provided max', () => {
        const list = Array.from({ length: 5 }).map((_, idx) => ({ id: idx + 1, name: `r${idx}`, html_url: `https://example.com/${idx}` }));
        const previews = takeRepoPreview(list, 2);
        expect(previews).toHaveLength(2);
        expect(previews[0]?.name).toBe('r0');
    });
});
