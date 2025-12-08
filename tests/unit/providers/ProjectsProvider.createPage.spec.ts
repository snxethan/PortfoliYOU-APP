import { generateUniquePageTitle } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('createPage default title uniqueness', () => {
    it('generates a unique page title when default name collides', () => {
        const nowStr = new Date().toISOString();
        const proj: any = {
            id: 'p1', name: 'Test', activeThemeId: 'a',
            pageOrder: ['p1', 'p2'],
            limits: { maxPages: 10, maxAssetsMB: 500 },
            status: { deployed: false, lastDeployAt: null, deployType: null },
            schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr,
            themes: {},
            pages: {
                p1: { pageId: 'p1', title: 'Page 2', order: 0, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr },
                p2: { pageId: 'p2', title: 'Home', order: 1, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: nowStr, updatedAt: nowStr }
            },
            widgets: {}
        } as any;
        const title = generateUniquePageTitle(proj, 'Page 2');
        expect(title).toBeDefined();
        expect(title.toLowerCase()).not.toBe('page 2');
    });
});
