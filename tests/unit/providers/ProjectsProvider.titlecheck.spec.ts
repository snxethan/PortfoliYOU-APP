import { projectHasPageTitle } from '../../../app/renderer/src/providers/ProjectsProvider';

describe('projectHasPageTitle', () => {
    it('detects duplicate titles case-insensitively', () => {
        const proj = {
            pageOrder: ['p1', 'p2'],
            pages: {
                p1: { pageId: 'p1', title: 'Home', order: 0, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                p2: { pageId: 'p2', title: 'About', order: 1, widgets: [], breakpoints: { desktop: true, tablet: true, mobile: true }, schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            }
        } as any;
        expect(projectHasPageTitle(proj, 'home')).toBeTruthy();
        expect(projectHasPageTitle(proj, 'HOME')).toBeTruthy();
        expect(projectHasPageTitle(proj, 'about ')).toBeTruthy();
        expect(projectHasPageTitle(proj, 'contact')).toBeFalsy();
        // Exclude a page id
        expect(projectHasPageTitle(proj, 'home', 'p1')).toBeFalsy();
    });
});
