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

export default function GridCanvas({ cols, gap, rowH, items, onChange, scrollEl, onDelete, onDuplicate, onItemMoveStart, onItemMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify }: {
  cols: number;
  gap: number;
  rowH: number;
  items: GridItem[];
  onChange: (next: GridItem[]) => void;
  scrollEl?: HTMLElement | null;
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
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const { setNodeRef, isOver } = useDroppable({ id: 'grid-canvas' });
  const { width } = size;

  const colW = useMemo(() => {
    if (cols <= 0) return 0;
    const inner = Math.max(0, width - gap * (cols - 1));
    return Math.floor(inner / cols);
  }, [width, cols, gap]);

  const metrics: GridMetrics = useMemo(() => ({ colW, rowH, gap, cols }), [colW, rowH, gap, cols]);

  // Calculate content height based on items so the grid background extends as needed
  const contentRows = useMemo(() => {
    if (!items || items.length === 0) return 12; // default rows
    return Math.max(12, ...items.map(it => it.y + it.h));
  }, [items]);
  const canvasHeight = useMemo(() => {
    const rows = Math.max(1, contentRows);
    return rows * rowH + (rows - 1) * gap;
  }, [contentRows, rowH, gap]);

  const bg = useMemo(() => {
    const cw = Math.max(1, colW);
    const gh = Math.max(0, gap);
    const unitX = cw + gh;
    const unitY = rowH + gh;
    // light grey grid lines to look like a page design tool; subtle in dark as well
    const line = 'rgba(0,0,0,0.08)';
    const vLine = `repeating-linear-gradient(to right, transparent 0, transparent ${cw}px, ${line} ${cw}px, ${line} ${unitX}px)`;
    const hLine = `repeating-linear-gradient(to bottom, transparent 0, transparent ${rowH}px, ${line} ${rowH}px, ${line} ${unitY}px)`;
    return `${vLine}, ${hLine}`;
  }, [colW, rowH, gap]);

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
    <div ref={assignRef} className="relative rounded border border-[color:var(--border)] bg-[color:var(--bg)]" style={{ minHeight: 384, height: canvasHeight, backgroundImage: bg }}>
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
        />
      ))}
      {/* Subtle overlay when ready to drop from palette */}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 rounded ring-2 ring-[color:var(--accent)]/40" />
      )}
    </div>
  );
}

export type { GridItem };
