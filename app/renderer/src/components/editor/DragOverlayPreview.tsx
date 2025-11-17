import React, { useLayoutEffect, useRef } from "react";

export type PaletteDrag = { src?: string; label?: string; w?: number; h?: number } | undefined;

type OverlaySize = { width: number; height: number };

export default function DragOverlayPreview({ activeDrag, onMeasure }: { activeDrag?: PaletteDrag; onMeasure?: (size: OverlaySize | null) => void }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (activeDrag?.src !== 'palette') {
            onMeasure?.(null);
            return;
        }
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        onMeasure?.({ width: rect.width, height: rect.height });
    }, [activeDrag, onMeasure]);

    if (activeDrag?.src !== 'palette') return null;
    return (
        <div
            ref={ref}
            className="pointer-events-none rounded px-2 py-1 text-xs bg-[color:var(--muted)]/80 border border-[color:var(--border)] shadow-lg text-[color:var(--fg)]"
        >
            {activeDrag.label ?? 'Widget'}
            {typeof activeDrag.w === 'number' && typeof activeDrag.h === 'number' ? (
                <span className="ml-2 text-[color:var(--fg-muted)]">· {activeDrag.w}x{activeDrag.h}</span>
            ) : null}
        </div>
    );
}
