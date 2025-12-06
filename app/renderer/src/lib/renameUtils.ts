import type { GridItem } from '../components/editor/canvas/GridCanvas';

export function applyRenameMapToItems(items: GridItem[] | undefined | null, renameMap: Record<string, string> | undefined | null): GridItem[] {
    if (!items || !Array.isArray(items)) return [];
    if (!renameMap || typeof renameMap !== 'object' || Object.keys(renameMap).length === 0) return [...items];
    return items.map(it => ({ ...it, id: renameMap[it.id] ?? it.id }));
}

export function applyRenameMapToIdList(ids: string[] | undefined | null, renameMap: Record<string, string> | undefined | null): string[] {
    if (!ids || !Array.isArray(ids)) return [];
    if (!renameMap || typeof renameMap !== 'object' || Object.keys(renameMap).length === 0) return [...ids];
    return ids.map(id => renameMap[id] ?? id);
}

export default { applyRenameMapToItems, applyRenameMapToIdList };
