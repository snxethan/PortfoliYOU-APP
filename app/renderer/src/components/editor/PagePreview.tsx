import React, { memo, useMemo } from 'react';

import WidgetRenderer from '../../widgets/Renderer';

import type { GridItem } from './canvas/GridCanvas';

function PagePreviewInner({ width, cols, gap, rowH, items, currentPageId, onNavigatePage }: {
    width: number;
    cols: number;
    gap: number;
    rowH: number;
    items: GridItem[];
    currentPageId?: string;
    onNavigatePage?: (pageId: string) => void;
}) {
    const colW = useMemo(() => {
        if (cols <= 0) return 0;
        const inner = Math.max(0, width - gap * (cols - 1));
        return Math.floor(inner / cols);
    }, [width, cols, gap]);

    const rows = useMemo(() => {
        if (!items || items.length === 0) return 12;
        return Math.max(12, ...items.map(it => it.y + it.h));
    }, [items]);

    // Enforce square grid in preview; fall back to provided row height when width is 0
    const effRowH = colW > 0 ? colW : rowH;

    const height = useMemo(() => {
        const r = Math.max(1, rows);
        return r * effRowH + (r - 1) * gap;
    }, [rows, effRowH, gap]);

    const sorted = useMemo(() => items.map((it, i) => ({ it, i }))
        .sort((a, b) => {
            const az = typeof a.it.z === 'number' ? a.it.z! : a.i;
            const bz = typeof b.it.z === 'number' ? b.it.z! : b.i;
            return az - bz;
        })
        .map(x => x.it), [items]);

    return (
        <div
            style={{ width, height, position: 'relative' as const }}
            onClick={(e) => {
                if (!onNavigatePage) return;
                const t = e.target as HTMLElement | null;
                if (!t) return;
                const a = t.closest('a[href]') as HTMLAnchorElement | null;
                if (!a) return;
                const raw = a.getAttribute('href') || '';
                if (raw.startsWith('#/page/')) {
                    e.preventDefault();
                    const pid = raw.slice('#/page/'.length);
                    if (pid) onNavigatePage(pid);
                }
            }}
        >
            {sorted.map((item) => {
                const unitX = colW + gap;
                const unitY = effRowH + gap;
                const left = item.x * unitX;
                const top = item.y * unitY;
                const wpx = item.w * colW + (item.w - 1) * gap;
                const hpx = item.h * effRowH + (item.h - 1) * gap;
                return (
                    <div
                        key={item.id}
                        style={{ position: 'absolute', left, top, width: wpx, height: hpx, zIndex: typeof item.z === 'number' ? 100 + item.z : undefined, overflow: 'hidden' }}
                    >
                        {item.type ? (
                            <WidgetRenderer instance={{ id: item.id, type: item.type, props: item.props ?? {} }} interactive={false} currentPageId={currentPageId} />
                        ) : (
                            <div style={{ fontSize: 10, color: 'var(--fg-muted)', border: '1px dashed var(--border)', borderRadius: 4, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Unknown widget</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const PagePreview = memo(PagePreviewInner);
export default PagePreview;
