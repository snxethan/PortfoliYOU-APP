import { useRef, useState } from "react";
import { Copy, Settings as SettingsIcon, Pin, PinOff, Trash2 } from "lucide-react";

import WidgetRenderer from "../../widgets/Renderer";

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



export default function DraggableItem({ item, metrics, onMove, scrollEl, onDelete, onDuplicate, onMoveStart, onMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify, selected, onSelect }: {
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
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  // Prevent unused param lint when certain actions are intentionally not rendered in toolbar
  void onDelete; void onBringToFront; void onSendToBack; void onBringForward; void onSendBackward;
  const { colW, rowH, gap, cols } = metrics;
  const startRef = useRef<{ x0: number; y0: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ w0: number; h0: number; sx: number; sy: number } | null>(null);
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
    // Select this item on pointer interaction
    onSelect?.(item.id);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    startRef.current = { x0: item.x, y0: item.y, sx: e.clientX, sy: e.clientY };
    onMoveStart?.({ ...item });
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (resizeRef.current) {
      // Resizing
      const r = resizeRef.current;
      const dx = e.clientX - r.sx;
      const dy = e.clientY - r.sy;
      const baseX = colW + gap;
      const baseY = rowH + gap;
      // Snap units scale with gap for micro adjustments; allow continuous scaling for small gaps
      const factor = Math.max(0, gap) / 12;
      const stepX = Math.max(1, Math.round(baseX * factor));
      const stepY = Math.max(1, Math.round(baseY * factor));
      let nw = Math.round((r.w0 * baseX + dx) / stepX * (stepX / baseX));
      let nh = Math.round((r.h0 * baseY + dy) / stepY * (stepY / baseY));
      nw = Math.max(1, Math.min(nw, cols - item.x));
      nh = Math.max(1, nh);
      if (nw !== item.w || nh !== item.h) onMove({ ...item, w: nw, h: nh });
      return;
    }
    if (!startRef.current) return;
    const s = startRef.current;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    const baseX = colW + gap;
    const baseY = rowH + gap;
    const factor = Math.max(0, gap) / 12;
    const stepX = Math.max(1, Math.round(baseX * factor));
    const stepY = Math.max(1, Math.round(baseY * factor));
    const kx = Math.round(dx / stepX);
    const ky = Math.round(dy / stepY);
    let nx = s.x0 + kx * (stepX / baseX);
    let ny = s.y0 + ky * (stepY / baseY);
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
    if (resizeRef.current) {
      // finalize resize
      const r = resizeRef.current;
      const prev: GridItem = { ...item, w: r.w0, h: r.h0 };
      const next: GridItem = { ...item };
      onMoveEnd?.(prev, next);
      resizeRef.current = null;
      setDragging(false);
      return;
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

  function onResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (item.locked || item.pinned) return;
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    resizeRef.current = { w0: item.w, h0: item.h, sx: e.clientX, sy: e.clientY };
    onMoveStart?.({ ...item });
    setDragging(true);
  }

  const outlineClass = selected ? 'ring-2 ring-black border-black' : 'hover:ring-2 hover:ring-black';
  return (
    <div className="absolute select-none group"
      style={{ left: pxLeft, top: pxTop, width: pxW, height: pxH, zIndex: dragging ? 5000 : (typeof item.z === 'number' ? 100 + item.z : undefined) }}
    >
      <div
        className={`h-full rounded-md border-2 bg-transparent ${outlineClass}`}
        role="button"
        aria-label={`Widget: ${item.title || item.type || 'item'}`}
        aria-grabbed={dragging ? true : undefined}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onFocus={() => onSelect?.(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenModify?.(item.id); }
          // Arrow key nudging is handled at the editor container level; allow bubbling
        }}
        onDoubleClick={() => onOpenModify?.(item.id)}
      >
        {/* Floating toolbar at top-right */}
        <div className={`absolute right-1 top-1 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${selected ? 'pointer-events-auto' : 'pointer-events-none group-hover:pointer-events-auto'}`} data-nodrag="true">
          {onOpenModify && (
            <button
              className="cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm"
              title="Widget settings"
              aria-label="Widget settings"
              onClick={(e) => { e.stopPropagation(); onOpenModify(item.id); }}
            >
              <SettingsIcon size={14} />
            </button>
          )}
          {onTogglePin && (
            <button
              className={`cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={item.pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
              aria-label={item.pinned ? 'Unpin widget' : 'Pin widget'}
              disabled={!!item.locked}
              onClick={(e) => { e.stopPropagation(); if (!item.locked) onTogglePin(item.id); }}
            >
              {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          )}
          {onDuplicate && (
            <button
              className={`cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Duplicate"
              aria-label="Duplicate widget"
              onClick={(e) => { e.stopPropagation(); if (!item.locked) onDuplicate(item.id); }}
            >
              <Copy size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className={`cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Delete"
              aria-label="Delete widget"
              onClick={(e) => { e.stopPropagation(); if (!item.locked) onDelete(item.id); }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Render actual widget content */}
        <div className="w-full h-full overflow-hidden">
          {item.type ? (
            <WidgetRenderer instance={{ id: item.id, type: item.type, props: item.props ?? {} }} />
          ) : (
            <div className="text-[10px] text-[color:var(--fg-muted)] border border-dashed border-[color:var(--border)] rounded h-full flex items-center justify-center">
              Unknown widget
            </div>
          )}
        </div>

        {/* Resize handle (bottom-right) */}
        {!item.locked && !item.pinned && (
          <div
            className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize"
            data-nodrag="true"
            onPointerDown={onResizePointerDown}
            title="Resize"
          >
            <div className="w-full h-full border-r-2 border-b-2 border-black rounded-br-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
