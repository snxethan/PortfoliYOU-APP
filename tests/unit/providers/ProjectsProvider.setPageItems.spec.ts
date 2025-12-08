import { resolveIncomingWidgetIds } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('resolveIncomingWidgetIds', () => {
    it('clones incoming widget id that is used by other pages', () => {
        const nowStr = new Date().toISOString();
        const proj: any = {
            id: 'p1',
            name: 'Test',
            activeThemeId: 'a',
            pageOrder: ['page1', 'page2'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1,
            createdAt: nowStr,
            updatedAt: nowStr,
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Page 1', order: 0, widgets: ['w1'], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
                page2: { pageId: 'page2', title: 'Page 2', order: 1, widgets: ['w2'], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            },
            widgets: {
                w1: { widgetId: 'w1', type: 'text', slot: 'default', order: 0, props: {}, layout: { x: 0, y: 0, w: 1, h: 1, z: 0 }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
                w2: { widgetId: 'w2', type: 'text', slot: 'default', order: 0, props: {}, layout: { x: 2, y: 2, w: 1, h: 1, z: 1 }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
            }
        };

        const incoming = [{ id: 'w2', x: 4, y: 4, w: 1, h: 1, z: 2, type: 'text', props: {} }];
        const { resolvedItems, nextWidgets } = resolveIncomingWidgetIds(proj, 'page1', incoming as any);
        expect(resolvedItems).toBeDefined();
        expect(resolvedItems.length).toBe(1);
        const newId = resolvedItems[0].id;
        expect(newId).not.toBe('w2');
        // Ensure nextWidgets contains the clone ID and preserves original
        expect(nextWidgets['w2']).toBeDefined();
        expect(nextWidgets[newId]).toBeDefined();
        // clone's layout matches incoming position
        expect((nextWidgets[newId].layout as any).x).toBe(4);
        expect((nextWidgets[newId].layout as any).y).toBe(4);
    });
});
