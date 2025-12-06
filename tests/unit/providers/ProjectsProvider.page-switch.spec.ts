import { applySetPageItemsToProject } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('setPageItems on page switch', () => {
    it('retains page widgets after switching pages', () => {
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

        // Save a widget to page1
        const wp = applySetPageItemsToProject(proj, 'page1', [{ id: 'w1', x: 0, y: 0, w: 1, h: 1, z: 0, type: 'text', props: {}, schemaVersion: 1 } as any]);
        expect(wp.pages.page1.widgets.length).toBe(1);
        const wid = wp.pages.page1.widgets[0];
        expect(wp.widgets[wid]).toBeDefined();

        // Save an empty set to page2 (simulate switching and saving)
        const wp2 = applySetPageItemsToProject(wp as any, 'page2', [] as any);
        // Ensure page1 still has its widget
        expect(wp2.pages.page1.widgets.length).toBe(1);
        const wid2 = wp2.pages.page1.widgets[0];
        expect(wp2.widgets[wid2]).toBeDefined();
    });
});
