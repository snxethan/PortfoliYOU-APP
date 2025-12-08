import { applySetPageItemsToProject } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('resolveIncomingWidgetIds clone reuse', () => {
    it('reuses clone for same origin when setPageItems called multiple times', () => {
        const nowStr = new Date().toISOString();
        const proj: any = {
            id: 'p1', name: 'Test', activeThemeId: 'a',
            pageOrder: ['page1', 'page2'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr,
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Page 1', order: 0, widgets: ['w1'], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
                page2: { pageId: 'page2', title: 'Page 2', order: 1, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            },
            widgets: {
                w1: { widgetId: 'w1', type: 'text', slot: 'default', order: 0, props: {}, layout: { x: 0, y: 0, w: 1, h: 1, z: 0 }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            }
        };

        // First save: clone w1 onto page2
        const p1 = applySetPageItemsToProject(proj as any, 'page2', [{ id: 'w1', x: 2, y: 2, w: 1, h: 1, z: 1, type: 'text', props: {} } as any]);
        const cloneId1 = p1.pages.page2.widgets[0];
        expect(cloneId1).not.toBe('w1');
        expect(p1.widgets[cloneId1]).toBeDefined();
        // Debug
        // eslint-disable-next-line no-console
        console.error('After first clone p1.widgets keys', Object.keys(p1.widgets));

        // Second save with same incoming id (w1) should reuse the same clone rather than creating a new one
        const p2 = applySetPageItemsToProject(p1 as any, 'page2', [{ id: 'w1', x: 3, y: 3, w: 1, h: 1, z: 2, type: 'text', props: {} } as any]);
        const cloneId2 = p2.pages.page2.widgets[0];
        expect(cloneId2).toBe(cloneId1);
        // Debug
        // eslint-disable-next-line no-console
        console.error('After second clone p2.pages.page2.widgets', p2.pages.page2.widgets, 'p2.widgets keys', Object.keys(p2.widgets));
        // No extra widget entries should exist beyond the two original+clone
        const widgetIds = Object.keys(p2.widgets);
        const cloneCount = widgetIds.filter(id => id !== 'w1').length;
        // Debug logging (error so it's visible even on failed tests)
        // eslint-disable-next-line no-console
        console.error('p2 widgets:', widgetIds, JSON.stringify(p2.widgets, null, 2));
        if (cloneCount !== 1) {
            throw new Error('unexpected clone count: ' + JSON.stringify({ cloneCount, widgetIds }) + ' ; details: ' + JSON.stringify(Object.fromEntries(Object.entries(p2.widgets).map(([k, v]) => [k, { origin: (v as any).originWidgetId || null }]))));
        }
    });
});
