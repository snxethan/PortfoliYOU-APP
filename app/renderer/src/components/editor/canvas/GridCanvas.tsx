import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";

import DraggableItem, { GridItem, GridMetrics } from "./DraggableItem";
import type { Theme } from "../../../themes/types";

export default function GridCanvas({ pageWidth, zoom, cols, gap, rowH, items, onChange, scrollEl, viewportHeight, onDelete, onDuplicate, onItemMoveStart, onItemMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify, onDropAsset, showGrid, selectedId, onSelect, theme }: {
  pageWidth: number;
  zoom: number;
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
  theme?: Theme | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'grid-canvas' });
  const zoomFactor = zoom || 1;

  const logicalColW = useMemo(() => {
    if (cols <= 0) return 0;
    return Math.floor(pageWidth / cols);
  }, [pageWidth, cols]);
  const logicalRowH = logicalColW > 0 ? logicalColW : rowH;
  const metrics: GridMetrics = useMemo(() => ({ colW: logicalColW, rowH: logicalRowH, gap, cols }), [logicalColW, logicalRowH, gap, cols]);

  const gapPx = gap * zoomFactor;
  const rowPx = logicalRowH * zoomFactor;
  const unitX = (logicalColW + gap) * zoomFactor;
  const unitY = (logicalRowH + gap) * zoomFactor;

  // Calculate content height based on items so the grid background extends as needed
  const contentRows = useMemo(() => {
    if (!items || items.length === 0) return 12; // default rows
    return Math.max(12, ...items.map(it => it.y + it.h));
  }, [items]);
  const canvasHeight = useMemo(() => {
    const rows = Math.max(1, contentRows);
    const intrinsic = rows * rowPx + (rows - 1) * gapPx;
    const minH = Math.max(0, (viewportHeight ?? 0) * zoomFactor);
    return Math.max(intrinsic, minH);
  }, [contentRows, rowPx, gapPx, viewportHeight, zoomFactor]);

  // Optional grid background for alignment (based on gap and rowH)
  const bg = useMemo(() => {
    if (!showGrid) return undefined as string | undefined;
    const baseX = Math.max(1, unitX || 0);
    const baseY = Math.max(1, unitY || 0);
    const line = 'rgba(0,0,0,0.08)';
    const vLine = `repeating-linear-gradient(to right, transparent 0, transparent ${baseX - 1}px, ${line} ${baseX - 1}px, ${line} ${baseX}px)`;
    const hLine = `repeating-linear-gradient(to bottom, transparent 0, transparent ${baseY - 1}px, ${line} ${baseY - 1}px, ${line} ${baseY}px)`;
    return `${vLine}, ${hLine}`;
  }, [showGrid, unitX, unitY]);

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
      ref={setNodeRef}
      className="relative bg-transparent"
      role="region"
      aria-label="Canvas editor"
      data-testid="grid-canvas"
      style={{ minHeight: 384, height: canvasHeight, width: pageWidth * zoomFactor, backgroundImage: bg }}
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
          zoom={zoomFactor}
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
          theme={theme}
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
