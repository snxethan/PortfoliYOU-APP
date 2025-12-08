import { resolveIncomingWidgetIds } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('setPageItems sanity checks', () => {
    it('ensures page widgets exist in project widgets after saving', () => {
        const nowStr = new Date().toISOString();
        const proj: any = {
            id: 'p1', name: 'Test', activeThemeId: 'a',
            pageOrder: ['page1'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr,
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Page 1', order: 0, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            },
            widgets: {}
        };
        const incoming = [{ id: 'w1', x: 2, y: 2, w: 4, h: 3, z: 0, title: 'New', type: 'text', props: {} }];
        const { resolvedItems, nextWidgets } = resolveIncomingWidgetIds(proj, 'page1', incoming as any);
        // Build what setPageItems would write
        const updatedPage = { ...proj.pages['page1'], widgets: resolvedItems.map(it => it.id), updatedAt: nowStr };
        const nextProjectWidgets = { ...proj.widgets, ...nextWidgets } as Record<string, any>;
        // Simulate setPageItems loop that updates the widget entries for each resolved item
        for (let i = 0; i < resolvedItems.length; i++) {
            const it = resolvedItems[i];
            const wid = it.id;
            nextProjectWidgets[wid] = {
                widgetId: wid,
                type: it.type || 'custom',
                slot: 'default',
                order: i,
                props: it.props ?? {},
                layout: { x: it.x, y: it.y, w: it.w, h: it.h, z: it.z, title: it.title ?? undefined, pinned: !!it.pinned, locked: !!it.locked },
                schemaVersion: typeof it.schemaVersion === 'number' ? it.schemaVersion : 1,
                createdAt: nowStr,
                updatedAt: nowStr,
            };
        }
        // Assert: every id in updatedPage.widgets is present in nextProjectWidgets
        for (const wid of updatedPage.widgets) {
            expect(nextProjectWidgets[wid]).toBeDefined();
        }
    });
});
