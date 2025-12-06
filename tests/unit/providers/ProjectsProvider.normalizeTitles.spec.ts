import { normalizeProjectPageTitles } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('normalizeProjectPageTitles', () => {
    it('makes titles unique by appending suffixes', () => {
        const now = new Date().toISOString();
        const proj = {
            id: 'p1',
            name: 'Test',
            activeThemeId: 'a',
            pageOrder: ['page1', 'page2', 'page3'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Home', order: 0, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: now, updatedAt: now },
                page2: { pageId: 'page2', title: 'Home', order: 1, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: now, updatedAt: now },
                page3: { pageId: 'page3', title: 'Home (1)', order: 2, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: now, updatedAt: now },
            },
            widgets: {}
        } as any;

        const normalized = normalizeProjectPageTitles(proj as any);
        const titles = normalized.pageOrder.map(pid => normalized.pages[pid]?.title);
        // Ensure each title unique
        const lower = titles.map(t => (t || '').toLowerCase());
        const set = new Set(lower);
        expect(set.size).toBe(lower.length);
        // First should be 'Home'
        expect(normalized.pages.page1.title).toBe('Home');
        // Subsequent should be changed
        expect(normalized.pages.page2.title?.toLowerCase()).not.toBe('home');
    });
});
