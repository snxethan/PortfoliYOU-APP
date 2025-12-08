import { useMemo, useState, useRef, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";

import type { Theme } from "../../../themes/types";
import type { WidgetThemeSnapshot } from "../../../widgets/theme";
import { hasAppendModifier, type SelectionChangeOptions, type MarqueeSelectionOptions } from "../selection";

import DraggableItem, { GridItem, GridMetrics } from "./DraggableItem";

export default function GridCanvas({ pageWidth, zoom, cols, gap, rowH, items, onChange, scrollEl, viewportHeight, onDelete, onDuplicate, onItemMoveStart, onItemMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify, onDropAsset, showGrid, selectedIds, onSelect, onMarqueeSelect, theme, themeSnapshot }: {
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
  selectedIds?: string[];
  onSelect?: (id: string | null, opts?: SelectionChangeOptions) => void;
  onMarqueeSelect?: (ids: string[], opts?: MarqueeSelectionOptions) => void;
  theme?: Theme | null;
  themeSnapshot?: WidgetThemeSnapshot | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'grid-canvas' });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const marqueeMeta = useRef<{ originX: number; originY: number; append: boolean } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const attachRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    containerRef.current = node;
  }, [setNodeRef]);
  const zoomFactor = zoom || 1;

  const logicalColW = useMemo(() => {
    if (cols <= 0) return 0;
    return Math.floor(pageWidth / cols);
  }, [pageWidth, cols]);
  const logicalRowH = logicalColW > 0 ? logicalColW : rowH;
  const metrics: GridMetrics = useMemo(() => ({ colW: logicalColW, rowH: logicalRowH, gap, cols }), [logicalColW, logicalRowH, gap, cols]);

  const gapPx = gap * zoomFactor;
  const colPx = logicalColW * zoomFactor;
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
      ref={attachRef}
      className="relative bg-transparent"
      role="region"
      aria-label="Canvas editor"
      data-testid="grid-canvas"
      style={{ minHeight: 384, height: canvasHeight, width: pageWidth * zoomFactor, backgroundImage: bg }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const container = containerRef.current;
        if (!container) return;
        // Interactions that originate on widgets should not trigger marquee selection
        if (e.target !== e.currentTarget) {
          return;
        }
        const rect = container.getBoundingClientRect();
        const originX = e.clientX - rect.left;
        const originY = e.clientY - rect.top;
        const append = hasAppendModifier(e);
        if (!append) onSelect?.(null);
        e.preventDefault();
        marqueeMeta.current = { originX, originY, append };
        setMarqueeBox({ x: originX, y: originY, w: 0, h: 0 });

        const handleMove = (evt: PointerEvent) => {
          const host = containerRef.current;
          if (!host || !marqueeMeta.current) return;
          const bounds = host.getBoundingClientRect();
          const currentX = Math.min(Math.max(evt.clientX - bounds.left, 0), bounds.width);
          const currentY = Math.min(Math.max(evt.clientY - bounds.top, 0), bounds.height);
          const { originX: startX, originY: startY } = marqueeMeta.current;
          const x = Math.min(startX, currentX);
          const y = Math.min(startY, currentY);
          const w = Math.abs(currentX - startX);
          const h = Math.abs(currentY - startY);
          setMarqueeBox({ x, y, w, h });
        };

        const finishSelection = (evt: PointerEvent) => {
          window.removeEventListener('pointermove', handleMove, true);
          window.removeEventListener('pointerup', finishSelection, true);
          window.removeEventListener('pointercancel', finishSelection, true);
          const meta = marqueeMeta.current;
          marqueeMeta.current = null;
          const host = containerRef.current;
          if (!meta || !host) { setMarqueeBox(null); return; }
          const bounds = host.getBoundingClientRect();
          const currentX = Math.min(Math.max(evt.clientX - bounds.left, 0), bounds.width);
          const currentY = Math.min(Math.max(evt.clientY - bounds.top, 0), bounds.height);
          const x = Math.min(meta.originX, currentX);
          const y = Math.min(meta.originY, currentY);
          const w = Math.abs(currentX - meta.originX);
          const h = Math.abs(currentY - meta.originY);
          setMarqueeBox(null);
          // Treat tiny drags as simple deselect taps
          if (w < 3 && h < 3) {
            if (!meta.append) onSelect?.(null);
            return;
          }
          const left = x;
          const top = y;
          const right = x + w;
          const bottom = y + h;
          const hits = sorted
            .filter((it) => {
              const itemLeft = it.x * unitX;
              const itemTop = it.y * unitY;
              const itemRight = itemLeft + (it.w * colPx + (it.w - 1) * gapPx);
              const itemBottom = itemTop + (it.h * rowPx + (it.h - 1) * gapPx);
              return itemRight >= left && itemLeft <= right && itemBottom >= top && itemTop <= bottom;
            })
            .map((it) => it.id);
          if (hits.length) {
            onMarqueeSelect?.(hits, { append: meta.append });
          } else if (!meta.append) {
            onSelect?.(null);
          }
        };

        window.addEventListener('pointermove', handleMove, true);
        window.addEventListener('pointerup', finishSelection, true);
        window.addEventListener('pointercancel', finishSelection, true);
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
          themeSnapshot={themeSnapshot}
          selected={selectedIds?.includes(it.id)}
          onSelect={(id, opts) => onSelect?.(id, opts)}
          onDropAsset={onDropAsset}
        />
      ))}
      {marqueeBox && marqueeBox.w > 0 && marqueeBox.h > 0 && (
        <div
          className="pointer-events-none absolute border border-[color:var(--app-accent)]/70 bg-[color:var(--app-accent)]/12 rounded-sm"
          style={{ left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h }}
        />
      )}
      {/* Subtle overlay when ready to drop from palette */}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-[color:var(--app-accent)]/50" />
      )}
    </div>
  );
}

export type { GridItem };
