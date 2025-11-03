import React from "react";

export type PaletteDrag = { src?: string; label?: string; w?: number; h?: number } | undefined;

export default function DragOverlayPreview({ activeDrag }: { activeDrag?: PaletteDrag }) {
    if (activeDrag?.src !== 'palette') return null;
    return (
        <div className="pointer-events-none rounded px-2 py-1 text-xs bg-[color:var(--muted)]/80 border border-[color:var(--border)] shadow-lg text-[color:var(--fg)]">
            {activeDrag.label ?? 'Widget'}
            {typeof activeDrag.w === 'number' && typeof activeDrag.h === 'number' ? (
                <span className="ml-2 text-[color:var(--fg-muted)]">· {activeDrag.w}x{activeDrag.h}</span>
            ) : null}
        </div>
    );
}
