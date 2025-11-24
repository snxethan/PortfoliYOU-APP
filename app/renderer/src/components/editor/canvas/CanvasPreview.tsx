import React, { memo, useMemo } from 'react';

import WidgetRenderer from '../../../widgets/Renderer';
import PreviewIframe from '../PreviewIframe';
import type { GridItem } from '../DraggableItem';

function CanvasPreviewInner({
    cols,
    gap,
    rowH,
    items,
    width,
}: {
    cols: number;
    gap: number;
    rowH: number;
    items: GridItem[];
    width: number;
}) {
    const colW = useMemo(() => {
        if (cols <= 0) return 0;
        const inner = Math.max(0, width - gap * (cols - 1));
        return Math.floor(inner / cols);
    }, [width, cols, gap]);

    // Compute content height to wrap the absolutely positioned children
    const contentRows = useMemo(() => {
        if (!items || items.length === 0) return 12;
        return Math.max(12, ...items.map((it) => it.y + it.h));
    }, [items]);
    const height = useMemo(() => {
        const rows = Math.max(1, contentRows);
        return rows * rowH + (rows - 1) * gap;
    }, [contentRows, rowH, gap]);

    return (
        <div className="mx-auto rounded-md shadow-sm border border-[color:var(--border)] bg-[color:var(--muted)]/30">
            <PreviewIframe width={width} height={height} className="block mx-auto" style={{ display: 'block' }}>
                <div className="relative" style={{ height }}>
                    {items.map((item, index) => {
                        const left = item.x * (colW + gap);
                        const top = item.y * (rowH + gap);
                        const w = item.w * colW + (item.w - 1) * gap;
                        const h = item.h * rowH + (item.h - 1) * gap;
                        const z = typeof item.z === 'number' ? 100 + item.z : 100 + index;
                        return (
                            <div key={item.id} style={{ position: 'absolute', left, top, width: w, height: h, zIndex: z }}>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                                    {item.type ? (
                                        <WidgetRenderer instance={{ id: item.id, type: item.type, props: item.props ?? {}, schemaVersion: item.schemaVersion }} />
                                    ) : (
                                        <div style={{ fontSize: 10, color: 'var(--fg-muted)', border: '1px dashed var(--border)', borderRadius: 4, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            Unknown widget
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </PreviewIframe>
        </div>
    );
}

const CanvasPreview = memo(CanvasPreviewInner);
export default CanvasPreview;
