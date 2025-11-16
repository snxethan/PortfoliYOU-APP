import { useEffect, useMemo, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";

import DraggableItem, { GridItem, GridMetrics } from "./DraggableItem";

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size } as const;
}

export default function GridCanvas({ cols, gap, rowH, items, onChange, scrollEl, viewportHeight, onDelete, onDuplicate, onItemMoveStart, onItemMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify, onDropAsset, showGrid, selectedId, onSelect }: {
  cols: number;
  gap: number;
  rowH: number;
  items: GridItem[];
  onChange: (next: GridItem[]) => void;
  scrollEl?: HTMLElement | null;
  viewportHeight?: number; // available height from parent container; grid will fill at least this
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onItemMoveStart?: (it: GridItem) => void;
  onItemMoveEnd?: (prev: GridItem, next: GridItem) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onOpenModify?: (id: string) => void;
  onDropAsset?: (id: string, hash: string) => void;
  showGrid?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const { setNodeRef, isOver } = useDroppable({ id: 'grid-canvas' });
  const { width } = size;

  const colW = useMemo(() => {
    if (cols <= 0) return 0;
    // Decouple column width from gap so gap affects spacing between items and step size more clearly
    return Math.floor(width / cols);
  }, [width, cols]);

  // Enforce square grid: row height equals column width
  const effRowH = colW;
  const metrics: GridMetrics = useMemo(() => ({ colW, rowH: effRowH, gap, cols }), [colW, effRowH, gap, cols]);

  // Calculate content height based on items so the grid background extends as needed
  const contentRows = useMemo(() => {
    if (!items || items.length === 0) return 12; // default rows
    return Math.max(12, ...items.map(it => it.y + it.h));
  }, [items]);
  const canvasHeight = useMemo(() => {
    const rows = Math.max(1, contentRows);
    const intrinsic = rows * effRowH + (rows - 1) * gap;
    const minH = Math.max(0, (viewportHeight ?? 0));
    return Math.max(intrinsic, minH);
  }, [contentRows, effRowH, gap, viewportHeight]);

  // Optional grid background for alignment (based on gap and rowH)
  const bg = useMemo(() => {
    if (!showGrid) return undefined as string | undefined;
    const baseX = Math.max(1, colW + gap);
    const baseY = Math.max(1, effRowH + gap);
    const line = 'rgba(0,0,0,0.08)';
    const vLine = `repeating-linear-gradient(to right, transparent 0, transparent ${baseX - 1}px, ${line} ${baseX - 1}px, ${line} ${baseX}px)`;
    const hLine = `repeating-linear-gradient(to bottom, transparent 0, transparent ${baseY - 1}px, ${line} ${baseY - 1}px, ${line} ${baseY}px)`;
    return `${vLine}, ${hLine}`;
  }, [showGrid, colW, effRowH, gap]);

  const assignRef = (el: HTMLDivElement | null) => {
    // Merge local ref used for size with droppable ref for DnD-kit
    ref.current = el;
    setNodeRef(el);
  };

  // Stable sort by z, falling back to original order for items without z
  const sorted = useMemo(() => items.map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const az = typeof a.it.z === 'number' ? a.it.z! : a.i;
      const bz = typeof b.it.z === 'number' ? b.it.z! : b.i;
      return az - bz;
    })
    .map(x => x.it), [items]);

  return (
    <div
      ref={assignRef}
      className="relative bg-white rounded-md border-2 border-black shadow-sm"
      role="region"
      aria-label="Canvas editor"
      style={{ minHeight: 384, height: canvasHeight, backgroundImage: bg }}
      onMouseDown={(e) => {
        // clicking on empty space clears selection
        if (e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {sorted.map((it) => (
        <DraggableItem
          key={it.id}
          item={it}
          metrics={metrics}
          scrollEl={scrollEl}
          onMove={(next) => onChange(items.map(x => x.id === it.id ? next : x))}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onMoveStart={onItemMoveStart}
          onMoveEnd={onItemMoveEnd}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onTogglePin={onTogglePin}
          onOpenModify={onOpenModify}
          selected={selectedId === it.id}
          onSelect={(id) => onSelect?.(id)}
          onDropAsset={onDropAsset}
        />
      ))}
      {/* Subtle overlay when ready to drop from palette */}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-[color:var(--accent)]/50" />
      )}
    </div>
  );
}

export type { GridItem };
