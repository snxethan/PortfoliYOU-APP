import { normalizeProjectWidgetReferences } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('normalizeProjectWidgetReferences', () => {
    it('duplicates widget entries for pages that reference the same widget id', () => {
        const proj = {
            id: 'p1',
            name: 'Test',
            activeThemeId: 'a',
            pageOrder: ['page1', 'page2'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            themes: {},
            pages: {
                page1: { pageId: 'page1', title: 'Page 1', order: 0, widgets: ['w1'], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                page2: { pageId: 'page2', title: 'Page 2', order: 1, widgets: ['w1'], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            },
            widgets: {
                w1: { widgetId: 'w1', type: 'text', slot: 'default', order: 0, props: {}, layout: { x: 0, y: 0, w: 1, h: 1, z: 0 }, schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            }
        } as any;

        const normalized = normalizeProjectWidgetReferences(proj);
        // Should have created a new widget id for page2, while keeping original for page1
        expect(normalized.pages.page1.widgets[0]).toBe('w1');
        const page2Wid = normalized.pages.page2.widgets[0];
        expect(page2Wid).not.toBe('w1');
        expect(normalized.widgets[page2Wid]).toBeDefined();
        // Original widget preserved
        expect(normalized.widgets['w1']).toBeDefined();
    });
});
