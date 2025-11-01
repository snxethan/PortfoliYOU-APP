import { useRef, useState } from "react";
import { Save, Undo, Redo } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, rectIntersection, DragOverlay } from "@dnd-kit/core";

import { useProjects } from "../providers/ProjectsProvider";
import GridCanvas, { GridItem } from "../components/portfolio/editor/GridCanvas";
import ModifyWidgetModal from "../components/portfolio/editor/ModifyWidgetModal";
import WidgetsPalette from "../components/portfolio/editor/WidgetsPalette";

const COLS = 12;
const DEFAULT_ROW_H = 32; // px height per row (content area)

export default function EditorPage() {
  const { selectedProject } = useProjects();

  // Gap between cells (both x and y), in pixels
  const [gap, setGap] = useState<number>(12);

  // Demo items to drag around the canvas
  const [items, setItems] = useState<GridItem[]>(() => [
    { id: "a", x: 0, y: 0, w: 4, h: 4, title: "Text Block", z: 0, type: 'text', props: {}, pinned: false, locked: false },
    { id: "b", x: 4, y: 0, w: 4, h: 4, title: "Image", z: 1, type: 'image', props: {}, pinned: false, locked: false },
  ]);

  // Simple undo/redo stacks (keep last 50 operations)
  type ItemsUpdater = (prev: GridItem[]) => GridItem[];
  type HistoryEntry = { label: string; undo: ItemsUpdater; redo: ItemsUpdater };
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  function commitUpdate(label: string, makeNext: ItemsUpdater) {
    setItems(prev => {
      const next = makeNext(prev);
      setHistory(h => {
        const entry: HistoryEntry = { label, undo: () => prev, redo: () => next };
        const nh = [...h, entry];
        return nh.length > MAX_HISTORY ? nh.slice(nh.length - MAX_HISTORY) : nh;
      });
      setRedoStack([]);
      return next;
    });
  }

  function undo() {
    setItems(prev => {
      if (history.length === 0) return prev;
      const entry = history[history.length - 1];
      const undone = entry.undo(prev);
      setHistory(h => h.slice(0, -1));
      setRedoStack(r => [...r, entry]);
      return undone;
    });
  }

  function redo() {
    setItems(prev => {
      if (redoStack.length === 0) return prev;
      const entry = redoStack[redoStack.length - 1];
      const redone = entry.redo(prev);
      setRedoStack(r => r.slice(0, -1));
      setHistory(h => [...h, entry]);
      return redone;
    });
  }

  const canUndo = history.length > 0;
  const canRedo = redoStack.length > 0;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem('py_editor_page_w')) || 1100; } catch { return 1100; }
  });

  // Active drag preview for palette items
  type PaletteDrag = { src?: string; label?: string; w?: number; h?: number } | undefined;
  const [activeDrag, setActiveDrag] = useState<PaletteDrag>(undefined);

  // Modify panel
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = items.find(i => i.id === editingId) || null;
  const [editTitle, setEditTitle] = useState<string>("");
  const [editPropsText, setEditPropsText] = useState<string>("{}");
  function openModify(id: string) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    setEditingId(id);
    setEditTitle(it.title);
    try { setEditPropsText(JSON.stringify(it.props ?? {}, null, 2)); } catch { setEditPropsText("{}"); }
  }
  function closeModify() {
    setEditingId(null);
  }

  // Helper to get max z and normalize layering to 0..n-1
  function normalizeZ(list: GridItem[]): GridItem[] {
    const withZ = list.map((it, i) => ({ ...it, z: typeof it.z === 'number' ? it.z : i }));
    const sorted = [...withZ].sort((a, b) => (a.z! - b.z!));
    return sorted.map((it, idx) => ({ ...it, z: idx }));
  }

  function bringToFront(id: string) {
    commitUpdate("Bring to front", (prev) => {
      const norm = normalizeZ(prev);
      const maxZ = norm.length - 1;
      return norm.map(it => it.id === id ? { ...it, z: maxZ } : it);
    });
  }
  function sendToBack(id: string) {
    commitUpdate("Send to back", (prev) => {
      const norm = normalizeZ(prev);
      return norm.map(it => it.id === id ? { ...it, z: 0 } : it);
    });
  }
  function bringForward(id: string) {
    commitUpdate("Bring forward", (prev) => {
      const norm = normalizeZ(prev);
      for (let i = 0; i < norm.length; i++) {
        if (norm[i].id === id && i < norm.length - 1) {
          const arr = [...norm];
          const tmp = arr[i];
          arr[i] = { ...arr[i + 1], z: i };
          arr[i + 1] = { ...tmp, z: i + 1 };
          return arr;
        }
      }
      return norm;
    });
  }
  function sendBackward(id: string) {
    commitUpdate("Send backward", (prev) => {
      const norm = normalizeZ(prev);
      for (let i = 0; i < norm.length; i++) {
        if (norm[i].id === id && i > 0) {
          const arr = [...norm];
          const tmp = arr[i];
          arr[i] = { ...arr[i - 1], z: i };
          arr[i - 1] = { ...tmp, z: i - 1 };
          return arr;
        }
      }
      return norm;
    });
  }

  function togglePin(id: string) {
    commitUpdate("Toggle pin", (prev) => prev.map(it => it.id === id ? { ...it, pinned: !it.pinned } : it));
  }
  function toggleLock(id: string) {
    commitUpdate("Toggle lock", (prev) => prev.map(it => it.id === id ? { ...it, locked: !it.locked } : it));
  }


  function beginResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = pageWidth;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (evt: PointerEvent) => {
      const dx = evt.clientX - startX;
      const next = Math.min(1600, Math.max(720, Math.round(startW + dx)));
      setPageWidth(next);
      try { localStorage.setItem('py_editor_page_w', String(next)); } catch { /* ignore */ }
    };
    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  }

  return (
    <div className="p-6 space-y-6">
      {!selectedProject && (
        <div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
          No portfolio selected. Go to Home and open one.
        </div>
      )}

      <section className="surface p-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--muted)]/40">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[color:var(--fg-muted)]">Editor</span>
            {selectedProject && <span className="text-[color:var(--fg-muted)]">·</span>}
            {selectedProject && <span className="font-medium">{selectedProject.name}</span>}
          </div>

          <div className="flex items-center gap-3">
            {/* Gap control */}
            <label className="hidden sm:flex items-center gap-2 text-xs text-[color:var(--fg-muted)]">
              <span>Gap</span>
              <input
                type="number"
                className="input w-16"
                min={0}
                max={48}
                step={1}
                value={gap}
                onChange={(e) => setGap(Number(e.target.value) || 0)}
                title="Grid gap (px)"
              />
              <span className="text-[10px]">px</span>
            </label>

            {/* Inactive placeholders for now */}
            <button className="btn btn-ghost flex items-center gap-2 text-sm disabled:opacity-60" title="Save (Ctrl/Cmd+S)" disabled>
              <Save size={16} />
              Save
            </button>
            <div className="w-px h-6 bg-[color:var(--border)] mx-1" />
            <button className="btn btn-ghost flex items-center gap-2 text-sm disabled:opacity-60" title="Undo" onClick={undo} disabled={!canUndo}>
              <Undo size={16} />
              Undo
            </button>
            <button className="btn btn-ghost flex items-center gap-2 text-sm disabled:opacity-60" title="Redo" onClick={redo} disabled={!canRedo}>
              <Redo size={16} />
              Redo
            </button>
          </div>
        </div>

        {/* Workspace */}
        <DndContext
          sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))}
          collisionDetection={rectIntersection}
          onDragStart={(event: DragStartEvent) => {
            const data = event.active.data.current as PaletteDrag;
            if (data?.src === 'palette') {
              setActiveDrag(data);
            }
          }}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;
            const data = active.data.current as { src?: string; label?: string; w?: number; h?: number } | undefined;
            if (data?.src === 'palette' && over.id === 'grid-canvas') {
              const overRect = over.rect;
              const initial = active.rect.current.initial;
              if (!initial) return;
              const centerX = initial.left + initial.width / 2 + event.delta.x;
              const centerY = initial.top + initial.height / 2 + event.delta.y;
              const relX = centerX - overRect.left;
              const relY = centerY - overRect.top;

              // Compute grid coordinates using the same math as GridCanvas
              const colW = Math.floor((overRect.width - gap * (COLS - 1)) / COLS);
              const unitX = colW + gap;
              const unitY = DEFAULT_ROW_H + gap;
              const w = data.w ?? 4;
              const h = data.h ?? 4;
              let x = Math.floor(relX / unitX);
              let y = Math.floor(relY / unitY);
              x = Math.max(0, Math.min(x, COLS - w));
              y = Math.max(0, y);
              const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
              const newItem: GridItem = { id, x, y, w, h, title: data.label ?? 'Widget', z: 0, type: (active.data.current as any)?.type, props: {}, pinned: false, locked: false };
              commitUpdate(`Add ${newItem.title}`, (prev) => {
                const norm = normalizeZ(prev);
                const maxZ = norm.length; // new item will be top
                return [...norm, { ...newItem, z: maxZ }];
              });
            }
            // Clear drag overlay when drop completes
            setActiveDrag(undefined);
          }}
          onDragCancel={() => setActiveDrag(undefined)}
        >
          {/* Visible drag preview while dragging from the palette */}
          <DragOverlay dropAnimation={null}>
            {activeDrag?.src === 'palette' ? (
              <div
                className="pointer-events-none rounded px-2 py-1 text-xs bg-[color:var(--muted)]/80 border border-[color:var(--border)] shadow-lg text-[color:var(--fg)]"
              >
                {activeDrag.label ?? 'Widget'}
                {typeof activeDrag.w === 'number' && typeof activeDrag.h === 'number' ? (
                  <span className="ml-2 text-[color:var(--fg-muted)]">· {activeDrag.w}x{activeDrag.h}</span>
                ) : null}
              </div>
            ) : null}
          </DragOverlay>
          <div className="grid grid-cols-[1fr_16rem] gap-0 min-h-[28rem]">
            {/* Canvas inside a page-like viewport */}
            <div className="p-4 min-w-0 overflow-x-auto">
              <div
                ref={scrollRef}
                className={"mx-auto min-h-[28rem] border border-[color:var(--border)] bg-white dark:bg-black/10 shadow-sm rounded-md overflow-auto relative"}
                style={{ width: pageWidth }}
              >
                <div className="p-4">
                  <GridCanvas
                    cols={COLS}
                    gap={gap}
                    rowH={DEFAULT_ROW_H}
                    items={items}
                    onChange={setItems}
                    scrollEl={scrollRef.current}
                    onDelete={(id) => commitUpdate("Delete item", (prev) => {
                      const tgt = prev.find(i => i.id === id);
                      if (!tgt) return prev;
                      return prev.filter((it) => it.id !== id);
                    })}
                    onDuplicate={(id) => commitUpdate("Duplicate item", (prev) => {
                      const src = prev.find((it) => it.id === id);
                      if (!src) return prev;
                      const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
                      const nx = Math.min(COLS - src.w, src.x + 1);
                      const ny = src.y + 1;
                      const norm = normalizeZ(prev);
                      const maxZ = norm.length; // place duplicate on top
                      return [...norm, { ...src, id: nid, x: nx, y: ny, title: src.title + " copy", z: maxZ }];
                    })}
                    onItemMoveStart={() => {/* no-op, but available if needed */ }}
                    onItemMoveEnd={(prevItem, nextItem) => {
                      if (prevItem.x === nextItem.x && prevItem.y === nextItem.y) return;
                      // Create a single history entry to set this item's position back and forth
                      const label = `Move ${nextItem.title}`;
                      setHistory(h => {
                        const entry: HistoryEntry = {
                          label,
                          undo: (items) => items.map(it => it.id === nextItem.id ? { ...it, x: prevItem.x, y: prevItem.y } : it),
                          redo: (items) => items.map(it => it.id === nextItem.id ? { ...it, x: nextItem.x, y: nextItem.y } : it),
                        };
                        const nh = [...h, entry];
                        return nh.length > MAX_HISTORY ? nh.slice(nh.length - MAX_HISTORY) : nh;
                      });
                      setRedoStack([]);
                    }}
                    onBringToFront={bringToFront}
                    onSendToBack={sendToBack}
                    onBringForward={bringForward}
                    onSendBackward={sendBackward}
                    onTogglePin={togglePin}
                    onOpenModify={openModify}
                  />
                </div>
                {/* Resize handle */}
                <div
                  className="absolute right-0 bottom-0 h-6 w-3 cursor-ew-resize flex items-center justify-center text-[color:var(--fg-muted)]"
                  title="Resize page width"
                  onPointerDown={beginResize}
                >
                  <div className="w-1 h-4 bg-[color:var(--border)] rounded" />
                </div>
              </div>
            </div>

            {/* Widget Sidebar (moved to the right) */}
            <aside className="border-l border-[color:var(--border)] p-3 bg-[color:var(--bg)]">
              <WidgetsPalette />
            </aside>
          </div>
        </DndContext>
      </section>

      {editingItem && (
        <ModifyWidgetModal
          item={editingItem}
          onClose={closeModify}
          onRename={(v) => commitUpdate("Rename widget", (prev) => prev.map(it => it.id === editingItem.id ? { ...it, title: v } : it))}
          onBringToFront={() => bringToFront(editingItem.id)}
          onSendToBack={() => sendToBack(editingItem.id)}
          onBringForward={() => bringForward(editingItem.id)}
          onSendBackward={() => sendBackward(editingItem.id)}
          onTogglePin={() => togglePin(editingItem.id)}
          onToggleLock={() => toggleLock(editingItem.id)}
          onApplyProps={(parsed) => commitUpdate("Update widget settings", (prev) => prev.map(it => it.id === editingItem.id ? { ...it, props: parsed } : it))}
        />
      )}
    </div>
  );
}
