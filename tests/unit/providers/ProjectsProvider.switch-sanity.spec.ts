import { applySetPageItemsToProject, normalizeProjectWidgetReferences, normalizeProjectPageTitles } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('switch sanity - pages keep their widgets after multiple setPageItems', () => {
    it('keeps widgets owned to their pages after multiple saves and sanitization', () => {
        const nowStr = new Date().toISOString();
        const proj: any = {
            id: 'p1', name: 'Test', activeThemeId: 'a',
            pageOrder: ['page1', 'page2'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr,
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Page 1', order: 0, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
                page2: { pageId: 'page2', title: 'Page 2', order: 1, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            },
            widgets: {}
        };

        // Add a widget to page1
        const proj1 = applySetPageItemsToProject(proj, 'page1', [{ id: 'w1', x: 0, y: 0, w: 1, h: 1, z: 0, type: 'text', props: {}, schemaVersion: 1 } as any]);
        expect(proj1.pages.page1.widgets.length).toBe(1);
        const wid1 = proj1.pages.page1.widgets[0];
        expect(proj1.widgets[wid1]).toBeDefined();

        // Add a widget to page2
        const proj2 = applySetPageItemsToProject(proj1 as any, 'page2', [{ id: 'w2', x: 0, y: 0, w: 1, h: 1, z: 0, type: 'text', props: {}, schemaVersion: 1 } as any]);
        expect(proj2.pages.page2.widgets.length).toBe(1);
        const wid2 = proj2.pages.page2.widgets[0];
        expect(proj2.widgets[wid2]).toBeDefined();

        // Sanitize project (normalize widget references and page titles) to ensure normalize functions don't drop widgets
        const step1 = normalizeProjectWidgetReferences(proj2 as any);
        const normalized = normalizeProjectPageTitles(step1 as any);
        expect(normalized.pages.page1.widgets.length).toBe(1);
        expect(normalized.pages.page2.widgets.length).toBe(1);
        expect(normalized.widgets[normalized.pages.page1.widgets[0]]).toBeDefined();
        expect(normalized.widgets[normalized.pages.page2.widgets[0]]).toBeDefined();
    });
});
