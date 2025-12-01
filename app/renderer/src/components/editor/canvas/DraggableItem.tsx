import { memo, useRef, useState } from "react";
import { Copy, Settings as SettingsIcon, Pin, PinOff, Trash2 } from "lucide-react";

import WidgetRenderer from "../../../widgets/Renderer";
import type { Theme } from "../../../themes/types";
import type { WidgetThemeSnapshot } from "../../../widgets/theme";
import { selectionOptionsFromPointerEvent, type SelectionChangeOptions } from "../selection";

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
  schemaVersion?: number; // persisted widget schema version
  pinned?: boolean; // cannot be moved when true
  locked?: boolean; // cannot be modified or moved when true
};

export type GridMetrics = {
  colW: number;
  rowH: number;
  gap: number;
  cols: number;
};



function DraggableItem({ item, metrics, onMove, scrollEl, zoom, onDelete, onDuplicate, onMoveStart, onMoveEnd, onBringToFront, onSendToBack, onBringForward, onSendBackward, onTogglePin, onOpenModify, onDropAsset, selected, onSelect, theme, themeSnapshot }: {
  item: GridItem;
  metrics: GridMetrics;
  onMove: (next: GridItem) => void;
  scrollEl?: HTMLElement | null;
  zoom: number;
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
  onDropAsset?: (id: string, hash: string) => void;
  selected?: boolean;
  onSelect?: (id: string | null, opts?: SelectionChangeOptions) => void;
  theme?: Theme | null;
  themeSnapshot?: WidgetThemeSnapshot | null;
}) {
  // Prevent unused param lint when certain actions are intentionally not rendered in toolbar
  void onDelete; void onBringToFront; void onSendToBack; void onBringForward; void onSendBackward;
  const { colW, rowH, gap, cols } = metrics;
  const zoomFactor = zoom || 1;
  const startRef = useRef<{ x0: number; y0: number; sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ w0: number; h0: number; sx: number; sy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const gapPx = gap * zoomFactor;
  const colPx = colW * zoomFactor;
  const rowPx = rowH * zoomFactor;
  const unitX = (colW + gap) * zoomFactor;
  const unitY = (rowH + gap) * zoomFactor;

  const pxLeft = item.x * unitX;
  const pxTop = item.y * unitY;
  const pxW = item.w * colPx + (item.w - 1) * gapPx;
  const pxH = item.h * rowPx + (item.h - 1) * gapPx;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only left click initiates drag
    if (e.button !== 0) return;
    // If the interaction started on a control marked as no-drag, skip drag start
    const t = e.target as HTMLElement | null;
    if (t && t.closest('[data-nodrag="true"]')) return;
    e.preventDefault();
    const selectionIntent = selectionOptionsFromPointerEvent(e);
    if (selectionIntent) {
      onSelect?.(item.id, selectionIntent);
    } else {
      onSelect?.(item.id);
    }
    // Do not start drag when pinned or locked
    if (item.pinned || item.locked) return;
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
      const dx = (e.clientX - r.sx) / zoomFactor;
      const dy = (e.clientY - r.sy) / zoomFactor;
      const baseX = colW + gap;
      const baseY = rowH + gap;
      // Strict grid snapping: whole-column and whole-row increments
      let nw = r.w0 + Math.round(dx / baseX);
      let nh = r.h0 + Math.round(dy / baseY);
      nw = Math.max(1, Math.min(nw, cols - item.x));
      nh = Math.max(1, nh);
      if (nw !== item.w || nh !== item.h) onMove({ ...item, w: nw, h: nh });
      return;
    }
    if (!startRef.current) return;
    const s = startRef.current;
    const dx = (e.clientX - s.sx) / zoomFactor;
    const dy = (e.clientY - s.sy) / zoomFactor;
    const baseX = colW + gap;
    const baseY = rowH + gap;
    const kx = Math.round(dx / baseX);
    const ky = Math.round(dy / baseY);
    let nx = s.x0 + kx;
    let ny = s.y0 + ky;
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

  const outlineClass = selected
    ? 'ring-2 ring-[color:var(--app-accent)] border-[color:var(--app-accent)] shadow-[0_0_0_3px_rgba(0,0,0,0.12)]'
    : 'border-[color:var(--border)] hover:ring-2 hover:ring-[color:var(--app-accent)]/45';
  const toolbarVisible = !!selected || hovered;
  return (
    <div className="absolute select-none group" style={{ left: pxLeft, top: pxTop, width: pxW, height: pxH, zIndex: dragging ? 5000 : (typeof item.z === 'number' ? 100 + item.z : undefined) }} data-widget-id={item.id} data-testid="widget-item">
      <div
        className={`h-full rounded-md border-2 bg-transparent transition ring-offset-2 ring-offset-white/40 ${outlineClass}`}
        data-selected={selected ? 'true' : 'false'}
        role="button"
        aria-label={`Widget: ${item.title || item.type || 'item'}`}
        tabIndex={0}
        onFocus={() => onSelect?.(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenModify?.(item.id); }
          // Arrow key nudging handled at editor container; allow bubbling
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => onOpenModify?.(item.id)}
      >
        {/* Floating toolbar at top-right */}
        <div
          className={`absolute right-1 top-1 flex items-center gap-1 transition-opacity ${toolbarVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
          style={{ pointerEvents: toolbarVisible ? 'auto' : 'none', zIndex: 20 }}
          data-nodrag="true"
          aria-hidden={!toolbarVisible}
        >
          {onOpenModify && (
            <button
              className="cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm"
              title="Widget settings"
              data-testid="widget-settings-btn"
              onClick={(e) => { e.stopPropagation(); onOpenModify(item.id); }}
            >
              <SettingsIcon size={14} />
            </button>
          )}
          {onTogglePin && (
            <button
              className={`cursor-pointer p-1 rounded bg-white text-black border-2 border-black hover:bg-neutral-100 shadow-sm ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={item.pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
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
              onClick={(e) => { e.stopPropagation(); if (!item.locked) onDuplicate(item.id); }}
            >
              <Copy size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className={`cursor-pointer p-1 rounded bg-red-50 text-red-600 border-2 border-red-500 hover:bg-red-100 shadow-sm ${item.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Delete"
              onClick={(e) => { e.stopPropagation(); if (!item.locked) onDelete(item.id); }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Render actual widget content */}
        <div
          className="w-full h-full overflow-hidden"
          onDragOver={(e) => {
            // Allow dropping asset hashes onto image widgets
            const isImage = item.type === 'image';
            if (!isImage || item.locked) return;
            const types = e.dataTransfer?.types || [];
            if (Array.from(types).some(t => t === 'application/x-asset-hash' || t === 'text/asset-hash' || t === 'text/plain')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            const isImage = item.type === 'image';
            if (!isImage || item.locked) return;
            let hash = '';
            try { hash = e.dataTransfer?.getData('application/x-asset-hash') || e.dataTransfer?.getData('text/asset-hash') || ''; } catch { /* ignore */ }
            if (!hash) {
              try {
                const plain = e.dataTransfer?.getData('text/plain') || '';
                if (plain.startsWith('asset://')) hash = plain.slice('asset://'.length);
              } catch { /* ignore */ }
            }
            if (hash) {
              e.preventDefault();
              e.stopPropagation();
              onDropAsset?.(item.id, hash);
            }
          }}
        >
          {item.type ? (
            <WidgetRenderer
              instance={{ id: item.id, type: item.type, props: item.props ?? {}, schemaVersion: item.schemaVersion }}
              editing
              interactive={false}
              theme={theme}
              themeSnapshot={themeSnapshot}
              onChangeProps={(partial) => {
                const nextProps = { ...((item.props as Record<string, unknown>) ?? {}), ...partial };
                onMove({ ...item, props: nextProps });
              }}
              onUpgradeInstance={(next) => {
                onMove({ ...item, props: next.props, schemaVersion: next.schemaVersion });
              }}
            />
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

export default memo(DraggableItem);
