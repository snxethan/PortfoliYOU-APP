import { useRef, useState } from "react";
import { Copy, Trash2, Settings as SettingsIcon, Pin, PinOff } from "lucide-react";

export type GridItem = {
  id: string;
  x: number; // col position (0..cols-1)
  y: number; // row position (0..n)
  w: number; // width in cols
  h: number; // height in rows
  title: string;
  z?: number; // stacking order (higher is on top)
  type?: string; // widget type key
  props?: unknown; // widget-specific configuration
  pinned?: boolean; // cannot be moved when true
  locked?: boolean; // cannot be modified or moved when true
};

export type GridMetrics = {
  colW: number;
  rowH: number;
  gap: number;
  cols: number;
};



export default function DraggableItem({ item, metrics, onMove, scrollEl, onDelete, onDuplicate, onMoveStart, onMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify }: {
  item: GridItem;
  metrics: GridMetrics;
  onMove: (next: GridItem) => void;
  scrollEl?: HTMLElement | null;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onMoveStart?: (prev: GridItem) => void;
  onMoveEnd?: (prev: GridItem, next: GridItem) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onOpenModify?: (id: string) => void;
}) {
  const { colW, rowH, gap, cols } = metrics;
  const startRef = useRef<{ x0: number; y0: number; sx: number; sy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const pxLeft = item.x * (colW + gap);
  const pxTop = item.y * (rowH + gap);
  const pxW = item.w * colW + (item.w - 1) * gap;
  const pxH = item.h * rowH + (item.h - 1) * gap;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only left click initiates drag
    if (e.button !== 0) return;
    // Do not start drag when pinned or locked
    if (item.pinned || item.locked) return;
    // If the interaction started on a control marked as no-drag, skip drag start
    const t = e.target as HTMLElement | null;
    if (t && t.closest('[data-nodrag="true"]')) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    startRef.current = { x0: item.x, y0: item.y, sx: e.clientX, sy: e.clientY };
    onMoveStart?.({ ...item });
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const s = startRef.current;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    const unitX = colW + gap;
    const unitY = rowH + gap;
    let nx = Math.round((s.x0 * unitX + dx) / unitX);
    let ny = Math.round((s.y0 * unitY + dy) / unitY);
    nx = Math.max(0, Math.min(nx, cols - item.w));
    ny = Math.max(0, ny);
    if (nx !== item.x || ny !== item.y) onMove({ ...item, x: nx, y: ny });

    // Auto-scroll when near scroll container edges
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const threshold = 40;
      const maxSpeed = 18; // px per tick
      if (e.clientY > rect.bottom - threshold) {
        const factor = Math.min(1, (e.clientY - (rect.bottom - threshold)) / threshold);
        scrollEl.scrollTop += Math.ceil(maxSpeed * factor);
      } else if (e.clientY < rect.top + threshold) {
        const factor = Math.min(1, ((rect.top + threshold) - e.clientY) / threshold);
        scrollEl.scrollTop -= Math.ceil(maxSpeed * factor);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.currentTarget as HTMLDivElement;
    if (typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(e.pointerId)) {
      try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const s = startRef.current;
    if (s) {
      if (s.x0 !== item.x || s.y0 !== item.y) {
        const prev: GridItem = { ...item, x: s.x0, y: s.y0 };
        const next: GridItem = { ...item };
        onMoveEnd?.(prev, next);
      }
    }
    startRef.current = null;
    setDragging(false);
  }

  return (
    <div className="absolute select-none" style={{ left: pxLeft, top: pxTop, width: pxW, height: pxH, zIndex: dragging ? 10000 : (typeof item.z === 'number' ? 100 + item.z : undefined) }}>
      <div className="h-full rounded border border-[color:var(--border)] bg-[color:var(--muted)]/30 backdrop-blur-[1px] shadow-sm">
        <div
          className="cursor-move text-xs flex items-center justify-between px-2 py-1 border-b border-[color:var(--border)] bg-[color:var(--muted)]/60"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="truncate">{item.title}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[color:var(--fg-muted)]">{item.w}×{item.h}</span>
            {/* Modify / Pin / Lock controls */}
            {onOpenModify && (
              <button
                className="cursor-pointer p-1 rounded hover:bg-[color:var(--muted)]/60"
                title="Widget settings"
                data-nodrag="true"
                onClick={(e) => { e.stopPropagation(); onOpenModify(item.id); }}
              >
                <SettingsIcon size={14} />
              </button>
            )}
            {onTogglePin && (
              <button
                className={`cursor-pointer p-1 rounded hover:bg-[color:var(--muted)]/60 ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={item.pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
                data-nodrag="true"
                disabled={!!item.locked}
                onClick={(e) => { e.stopPropagation(); if (!item.locked) onTogglePin(item.id); }}
              >
                {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
              </button>
            )}
            {onDuplicate && (
              <button
                className={`cursor-pointer p-1 rounded hover:bg-[color:var(--muted)]/60 ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Duplicate"
                data-nodrag="true"
                onClick={(e) => { e.stopPropagation(); if (!item.locked) onDuplicate(item.id); }}
              >
                <Copy size={14} />
              </button>
            )}
            {onDelete && (
              <button
                className={`cursor-pointer p-1 rounded hover:bg-[color:var(--muted)]/60 text-red-500 ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Delete"
                data-nodrag="true"
                onClick={(e) => { e.stopPropagation(); if (!item.locked) onDelete(item.id); }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="p-2 text-[11px] text-[color:var(--fg-muted)] h-[calc(100%-28px)]">
          Snap-enabled drag. Gap: {gap}px
        </div>
      </div>
    </div>
  );
}
