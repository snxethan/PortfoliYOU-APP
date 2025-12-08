import { describe, it, expect } from 'vitest';
import { applyRenameMapToItems, applyRenameMapToIdList } from '../../../app/renderer/src/lib/renameUtils';

describe('renameUtils', () => {
    it('applies renameMap to items array', () => {
        const items = [{ id: 'a', x: 0, y: 0, w: 1, h: 1, z: 0, title: 'A', type: 'text', props: {} }, { id: 'b', x: 0, y: 1, w: 1, h: 1, z: 0, title: 'B', type: 'text', props: {} }];
        const renameMap = { a: 'x' };
        const next = applyRenameMapToItems(items as any, renameMap);
        expect(next.map(i => i.id)).toEqual(['x', 'b']);
        expect(next[0].title).toBe('A');
    });

    it('applies renameMap to id lists', () => {
        const ids = ['a', 'b', 'c'];
        const renameMap = { b: 'beta', c: 'gamma' };
        const next = applyRenameMapToIdList(ids, renameMap);
        expect(next).toEqual(['a', 'beta', 'gamma']);
    });

    it('handles empty renameMap or undefined inputs', () => {
        expect(applyRenameMapToItems(undefined as any, null as any)).toEqual([]);
        const items = [{ id: 'a' } as any];
        expect(applyRenameMapToItems(items, {})).toEqual(items);
        expect(applyRenameMapToIdList(undefined as any, null as any)).toEqual([]);
        expect(applyRenameMapToIdList(['a'], {})).toEqual(['a']);
    });
});
