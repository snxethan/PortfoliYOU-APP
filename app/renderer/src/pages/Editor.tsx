import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, rectIntersection, DragOverlay, type Modifier } from "@dnd-kit/core";

import { useProjects } from "../providers/ProjectsProvider";
import { useNotifications } from '../providers/NotificationsProvider';
import type { GridItem } from "../components/editor/canvas/GridCanvas";
const ModifyWidgetModal = lazy(() => import("../components/editor/widgets/ModifyWidgetModal"));
const WidgetsPalette = lazy(() => import("../components/editor/widgets/WidgetsPalette"));
import PageSettingsModal from "../components/modals/PageSettingsModal";
import EditorTopBar from "../components/editor/EditorTopBar";
import PageControls from "../components/editor/PageControls";
import ViewportSurface from "../components/editor/ViewportSurface";
import DragOverlayPreview from "../components/editor/DragOverlayPreview";
import AssetsPanel from "../components/editor/widgets/AssetsPanel";
import PreviewPopup from "../components/editor/PreviewPopup";
import PagePreview from "../components/editor/PagePreview";
import { usePersistentFlag } from "../hooks/usePersistentFlag";

const COLS = 12;
const DEFAULT_ROW_H = 32; // px height per row (content area)
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.75;

export default function EditorPage() {
  const { selectedProject, createPage, deletePage, renamePage, getPageItems, setPageItems, setPageStarter } = useProjects();
  const { add: notify } = useNotifications();
  const navigate = useNavigate();

  // Track current page within the selected project
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedProject) { setCurrentPageId(null); return; }
    try {
      const stored = localStorage.getItem(`py_current_page_${selectedProject.id}`);
      const fallback = selectedProject.pageOrder?.[0] || null;
      setCurrentPageId(stored || fallback || null);
    } catch {
      const fallback = selectedProject.pageOrder?.[0] || null;
      setCurrentPageId(fallback || null);
    }
  }, [selectedProject?.id]);

  // If project is cloud-linked, ensure the selected page is within the first 10
  useEffect(() => {
    if (!selectedProject || !currentPageId) return;
    const isCloud = !!(selectedProject as unknown as { _cloudId?: string })._cloudId;
    if (!isCloud) return;
    const idx = (selectedProject.pageOrder || []).indexOf(currentPageId);
    if (idx >= 10) {
      const fallback = selectedProject.pageOrder?.[0] || null;
      setCurrentPageId(fallback);
      try { if (fallback) localStorage.setItem(`py_current_page_${selectedProject.id}`, fallback); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('py:notify', { detail: { type: 'warn', message: 'Cloud projects support up to 10 pages. Showing first page.' } }));
    }
  }, [selectedProject?._cloudId, selectedProject?.pageOrder, currentPageId]);

  // Page settings modal state
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameOldTitle, setRenameOldTitle] = useState<string>("");
  const [renameInitialStarter, setRenameInitialStarter] = useState<boolean>(false);

  // Gap between cells (both x and y), in pixels
  const [gap, setGap] = useState<number>(12);

  // Demo items to drag around the canvas
  const [items, setItems] = useState<GridItem[]>([]);

  // Load items from provider whenever project/page changes
  useEffect(() => {
    if (!selectedProject || !currentPageId) { setItems([]); return; }
    const loaded = getPageItems(selectedProject.id, currentPageId) as GridItem[];
    setItems(loaded);
  }, [selectedProject?.id, currentPageId, getPageItems]);

  // Simple undo/redo stacks (keep last 50 operations)
  type ItemsUpdater = (prev: GridItem[]) => GridItem[];
  type HistoryEntry = { label: string; undo: ItemsUpdater; redo: ItemsUpdater; onUndo?: () => void; onRedo?: () => void };
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const commitUpdate = useCallback((label: string, makeNext: ItemsUpdater) => {
    setItems(prev => {
      const next = makeNext(prev);
      setHistory(h => {
        const entry: HistoryEntry = { label, undo: () => prev, redo: () => next };
        const nh = [...h, entry];
        return nh.length > MAX_HISTORY ? nh.slice(nh.length - MAX_HISTORY) : nh;
      });
      setRedoStack([]);
      if (selectedProject && currentPageId) {
        // Persist into provider/project
        try {
          const mapped = next.map(it => ({
            id: it.id,
            x: it.x, y: it.y, w: it.w, h: it.h,
            z: typeof it.z === 'number' ? it.z : 0,
            title: it.title, type: it.type, props: it.props,
            pinned: it.pinned, locked: it.locked,
          }));
          setPageItems(selectedProject.id, currentPageId, mapped);
        } catch { /* ignore */ }
      }
      return next;
    });
  }, [currentPageId, selectedProject?.id, setPageItems]);

  function undo() {
    setItems(prev => {
      if (history.length === 0) return prev;
      const entry = history[history.length - 1];
      const undone = entry.undo(prev);
      setHistory(h => h.slice(0, -1));
      setRedoStack(r => [...r, entry]);
      // Run side-effect for page-level actions (create/delete/rename)
      entry.onUndo?.();
      // notify user of successful undo
      try { notify({ type: 'info', message: `Undid: ${entry.label}`, title: selectedProject?.name, persistent: false }); } catch { /* noop */ }
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
      entry.onRedo?.();
      try { notify({ type: 'info', message: `Redid: ${entry.label}`, title: selectedProject?.name, persistent: false }); } catch { /* noop */ }
      return redone;
    });
  }

  const canUndo = history.length > 0;
  const canRedo = redoStack.length > 0;

  // Standalone popup preview state
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  function openWebpage() { setPopupOpen(true); }
  function closeWebpage() { setPopupOpen(false); }

  const [zoom, setZoom] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem('py_editor_zoom'));
      if (!Number.isFinite(stored) || stored <= 0) return 1;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stored));
    } catch {
      return 1;
    }
  });
  const applyZoom = useCallback((value: number | ((prev: number) => number)) => {
    setZoom((prev) => {
      const target = typeof value === 'function' ? value(prev) : value;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(target) ? target : prev));
      try { localStorage.setItem('py_editor_zoom', String(clamped)); } catch { /* ignore */ }
      return clamped;
    });
  }, []);
  const zoomIn = useCallback(() => applyZoom((prev) => prev + 0.1), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom((prev) => prev - 0.1), [applyZoom]);
  const resetZoom = useCallback(() => applyZoom(1), [applyZoom]);
  useEffect(() => {
    function handleZoomHotkeys(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.shiftKey) return; // allow Ctrl+Shift combos to control global/app zoom
      const key = e.key;
      if (key === '=' || key === '+') {
        e.preventDefault();
        e.stopPropagation();
        zoomIn();
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        e.stopPropagation();
        zoomOut();
      } else if (key === '0' || key === ')') {
        e.preventDefault();
        e.stopPropagation();
        resetZoom();
      }
    }
    window.addEventListener('keydown', handleZoomHotkeys, true);
    return () => window.removeEventListener('keydown', handleZoomHotkeys, true);
  }, [zoomIn, zoomOut, resetZoom]);

  const [pageWidth, setPageWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem('py_editor_page_w')) || 1300; } catch { return 1300; }
  });
  const [activeView, setActiveView] = useState<'desktop' | 'mobile'>(() => {
    try { return (localStorage.getItem('py_editor_view') as 'desktop' | 'mobile') || 'desktop'; } catch { return 'desktop'; }
  });
  function applyPageWidth(w: number) {
    const clamped = Math.min(1600, Math.max(320, Math.round(w)));
    setPageWidth(clamped);
    try { localStorage.setItem('py_editor_page_w', String(clamped)); } catch { /* ignore */ }
  }
  function setDesktopView() {
    setActiveView('desktop');
    try { localStorage.setItem('py_editor_view', 'desktop'); } catch { /* ignore */ }
    applyPageWidth(1200);
  }
  function setMobileView() {
    setActiveView('mobile');
    try { localStorage.setItem('py_editor_view', 'mobile'); } catch { /* ignore */ }
    applyPageWidth(390);
  }
  // Collapsible widgets palette
  const [paletteCollapsed, setPaletteCollapsed] = usePersistentFlag('py_palette_collapsed');
  function togglePalette() {
    setPaletteCollapsed(prev => !prev);
  }
  // Grid overlay toggle
  const [showGrid, setShowGrid] = usePersistentFlag('py_show_grid');
  function toggleGrid() {
    setShowGrid(prev => !prev);
  }

  // Preview mode toggle
  const [previewMode, setPreviewMode] = usePersistentFlag('py_preview_mode');
  function togglePreviewMode() {
    setPreviewMode(prev => !prev);
  }

  // Collapsible sections inside the sidebar
  const [widgetsOpen, setWidgetsOpen] = usePersistentFlag('py_widgets_section_open', true);
  const [assetsOpen, setAssetsOpen] = usePersistentFlag('py_assets_section_open', true);
  function toggleWidgetsOpen() {
    setWidgetsOpen(prev => !prev);
  }
  function toggleAssetsOpen() {
    setAssetsOpen(prev => !prev);
  }

  // Page viewport height (applies to canvas and preview)
  const [pageHeight, setPageHeight] = useState<number>(() => {
    try { return Number(localStorage.getItem('py_editor_page_h')) || 900; } catch { return 900; }
  });
  // Height behavior: expand grows with content; fixed keeps pageHeight and allows internal scroll
  const [heightMode, setHeightMode] = useState<'expand' | 'fixed'>(() => {
    try { return (localStorage.getItem('py_editor_hmode') as 'expand' | 'fixed') || 'expand'; } catch { return 'expand'; }
  });
  function applyHeightMode(m: 'expand' | 'fixed') {
    setHeightMode(m);
    try { localStorage.setItem('py_editor_hmode', m); } catch { /* ignore */ }
  }

  // Selection + keyboard shortcuts
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<GridItem | null>(null);
  function withSelected(mut: (it: GridItem) => GridItem | GridItem[] | null, label: string) {
    if (!selectedId) return;
    const src = items.find(i => i.id === selectedId);
    if (!src) return;
    const result = mut(src);
    if (!result) return;
    if (Array.isArray(result)) {
      commitUpdate(label, () => result);
    } else {
      commitUpdate(label, (prev) => prev.map(i => i.id === selectedId ? result : i));
    }
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Do not interfere with typing in inputs/textareas
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute('contenteditable') === 'true')) return;
    // Movement
    if (selectedId && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      withSelected((it) => {
        if (it.pinned || it.locked) return null;
        const nx = Math.max(0, Math.min(it.x + dx, COLS - it.w));
        const ny = Math.max(0, it.y + dy);
        if (nx === it.x && ny === it.y) return null;
        return { ...it, x: nx, y: ny };
      }, 'Nudge widget');
      return;
    }
    // Delete
    if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      commitUpdate('Delete item', (prev) => prev.filter(i => i.id !== selectedId));
      setSelectedId(null);
      return;
    }
    // Copy/Cut/Paste/Duplicate
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === 'c' && selectedId) {
      e.preventDefault();
      const src = items.find(i => i.id === selectedId) || null;
      setClipboard(src ? { ...src } : null);
      return;
    }
    if (meta && e.key.toLowerCase() === 'x' && selectedId) {
      e.preventDefault();
      const src = items.find(i => i.id === selectedId) || null;
      setClipboard(src ? { ...src } : null);
      commitUpdate('Cut item', (prev) => prev.filter(i => i.id !== selectedId));
      setSelectedId(null);
      return;
    }
    if (meta && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      if (!clipboard) return;
      const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
      const nx = Math.min(COLS - clipboard.w, (clipboard.x ?? 0) + 1);
      const ny = (clipboard.y ?? 0) + 1;
      const dup: GridItem = { ...clipboard, id: nid, x: nx, y: ny, title: (clipboard.title || 'Widget') + ' copy' };
      commitUpdate('Paste item', (prev) => {
        const norm = normalizeZ(prev);
        const maxZ = norm.length;
        return [...norm, { ...dup, z: maxZ }];
      });
      setSelectedId(nid);
      return;
    }
    if (meta && e.key.toLowerCase() === 'd' && selectedId) {
      e.preventDefault();
      const src = items.find(i => i.id === selectedId);
      if (!src) return;
      const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
      const nx = Math.min(COLS - src.w, src.x + 1);
      const ny = src.y + 1;
      const dup: GridItem = { ...src, id: nid, x: nx, y: ny, title: src.title + ' copy' };
      commitUpdate('Duplicate item', (prev) => {
        const norm = normalizeZ(prev);
        const maxZ = norm.length;
        return [...norm, { ...dup, z: maxZ }];
      });
      setSelectedId(nid);
      return;
    }
  }

  // Active drag preview for palette items
  type PaletteDrag = { src?: string; label?: string; w?: number; h?: number } | undefined;
  const [activeDrag, setActiveDrag] = useState<PaletteDrag>(undefined);
  const dragPointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragPointerOffset = useRef<{ x: number; y: number } | null>(null);
  const dragOverlaySize = useRef<{ width: number; height: number } | null>(null);

  const dragOverlayCursorAlign = useMemo<Modifier>(() => (({ transform, activeNodeRect }) => {
    if (!transform) return transform;
    const pointerOffset = dragPointerOffset.current;
    const overlaySize = dragOverlaySize.current;
    const fallbackOffsetX = activeNodeRect ? activeNodeRect.width / 2 : 0;
    const fallbackOffsetY = activeNodeRect ? activeNodeRect.height / 2 : 0;
    const offsetX = pointerOffset?.x ?? fallbackOffsetX;
    const offsetY = pointerOffset?.y ?? fallbackOffsetY;
    const overlayHalfW = overlaySize ? overlaySize.width / 2 : fallbackOffsetX;
    const overlayHalfH = overlaySize ? overlaySize.height / 2 : fallbackOffsetY;
    return {
      ...transform,
      x: transform.x + offsetX - overlayHalfW,
      y: transform.y + offsetY - overlayHalfH,
    };
  }) as Modifier, []);

  // Modify panel
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = items.find(i => i.id === editingId) || null;
  function openModify(id: string) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    setEditingId(id);
  }
  function closeModify() {
    setEditingId(null);
  }

  useEffect(() => {
    setHistory([]);
    setRedoStack([]);
    setSelectedId(null);
    setClipboard(null);
    setEditingId(null);
  }, [selectedProject?.id, currentPageId]);

  useEffect(() => {
    if (!editingId) return;
    if (!items.some(it => it.id === editingId)) {
      setEditingId(null);
    }
  }, [items, editingId]);

  // Keyboard add fallback from palette tiles
  useEffect(() => {
    function onAddWidget(e: Event) {
      const ce = e as CustomEvent<{ type: string; label?: string; w?: number; h?: number }>;
      const defW = Math.max(1, Math.min(COLS, ce.detail?.w ?? 4));
      const defH = Math.max(1, ce.detail?.h ?? 4);
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
      const newItem: GridItem = { id, x: 0, y: 0, w: defW, h: defH, z: 0, title: ce.detail?.label || 'Widget', type: ce.detail?.type, props: {}, pinned: false, locked: false };
      commitUpdate(`Add ${newItem.title}`, (prev) => {
        const norm = normalizeZ(prev);
        const maxZ = norm.length;
        return [...norm, { ...newItem, z: maxZ }];
      });
      setSelectedId(id);
    }
    window.addEventListener('py:addWidget', onAddWidget as EventListener);
    return () => window.removeEventListener('py:addWidget', onAddWidget as EventListener);
  }, [commitUpdate]);

  // Helper to normalize layering to 0..n-1 in ascending z order
  function normalizeZ(list: GridItem[]): GridItem[] {
    const withZ = list.map(it => ({ ...it, z: typeof it.z === 'number' ? it.z : 0 }));
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




  return (
    <div className="p-4 space-y-5">
      {!selectedProject && (
        <div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
          No portfolio selected. Go to Home and open one.
        </div>
      )}

      <section className="surface p-0 overflow-hidden">
        {/* Top bar */}
        <EditorTopBar
          selectedProjectName={selectedProject?.name}
          onTitleClick={() => { navigate('/'); setTimeout(() => { window.dispatchEvent(new CustomEvent('py:highlight-request')); }, 50); }}
          previewMode={previewMode}
          togglePreviewMode={togglePreviewMode}
          gap={gap}
          setGap={setGap}
          showGrid={showGrid}
          toggleGrid={toggleGrid}
          activeView={activeView}
          setDesktopView={setDesktopView}
          setMobileView={setMobileView}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          heightMode={heightMode}
          setHeightMode={applyHeightMode}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          canUndo={canUndo}
          canRedo={canRedo}
          undo={undo}
          redo={redo}
          onOpenWebpage={openWebpage}
        />

        {/* Page management section */}
        {selectedProject && (
          <PageControls
            isCloud={!!(selectedProject as unknown as { _cloudId?: string })._cloudId}
            pageOrder={selectedProject.pageOrder || []}
            pages={selectedProject.pages}
            currentPageId={currentPageId}
            onSelectPage={(id) => {
              setCurrentPageId(id);
              if (selectedProject && id) {
                try { localStorage.setItem(`py_current_page_${selectedProject.id}`, id); } catch { /* ignore */ }
                setItems(getPageItems(selectedProject.id, id) as GridItem[]);
              } else {
                setItems([]);
              }
            }}
            onCreatePage={() => {
              if (!selectedProject) return;
              const prevId = currentPageId;
              const id = createPage(selectedProject.id) || null;
              if (id) {
                setCurrentPageId(id);
                try { localStorage.setItem(`py_current_page_${selectedProject.id}`, id); } catch { /* ignore */ }
                setItems([]);
                setHistory(h => {
                  const entry: HistoryEntry = {
                    label: 'Create page',
                    undo: (items) => items,
                    redo: (items) => items,
                    onUndo: () => {
                      deletePage(selectedProject.id, id);
                      const backId = prevId || (selectedProject.pageOrder?.[0] || null);
                      if (backId) {
                        setCurrentPageId(backId);
                        const loaded = getPageItems(selectedProject.id, backId) as GridItem[];
                        setItems(loaded);
                      }
                    },
                    onRedo: () => {
                      const newId = createPage(selectedProject.id);
                      if (newId) {
                        setCurrentPageId(newId);
                        setItems([]);
                      }
                    }
                  };
                  return [...h, entry];
                });
                setRedoStack([]);
              }
            }}
            onRenameInline={(newName: string) => {
              if (!selectedProject || !currentPageId) return;
              const oldTitle = selectedProject.pages[currentPageId]?.title || 'Untitled';
              const trimmed = (newName || '').trim();
              if (!trimmed || trimmed === oldTitle) return;
              // history entry
              setHistory(h => {
                const entry: HistoryEntry = {
                  label: 'Rename page',
                  undo: (items) => items,
                  redo: (items) => items,
                  onUndo: () => { renamePage(selectedProject.id, currentPageId, oldTitle); },
                  onRedo: () => { renamePage(selectedProject.id, currentPageId, trimmed); },
                } as HistoryEntry;
                return [...h, entry];
              });
              setRedoStack([]);
              renamePage(selectedProject.id, currentPageId, trimmed);
              try { localStorage.setItem(`py_current_page_${selectedProject.id}`, currentPageId); } catch { /* ignore */ }
              try { setItems(getPageItems(selectedProject.id, currentPageId) as GridItem[]); } catch { /* ignore */ }
            }}
            onOpenSettings={() => {
              if (!selectedProject || !currentPageId) return;
              const oldTitle = selectedProject.pages[currentPageId]?.title || 'Untitled';
              setRenameOldTitle(oldTitle);
              setRenameInitialStarter(Boolean(selectedProject.pages[currentPageId]?.starter));
              setRenameModalOpen(true);
            }}
            onDeleteCurrentPage={() => {
              if (!selectedProject || !currentPageId) return;
              const total = selectedProject.pageOrder?.length ?? 0;
              if (total <= 1) return;
              const title = selectedProject.pages[currentPageId]?.title || 'Untitled';
              const ok = window.confirm(`Delete page "${title}"? This cannot be undone.`);
              if (!ok) return;
              const snapItems = getPageItems(selectedProject.id, currentPageId) as GridItem[];
              const removedId = currentPageId;
              const remaining = (selectedProject.pageOrder || []).filter(id => id !== currentPageId);
              const nextId = remaining[0] || null;
              deletePage(selectedProject.id, removedId);
              setCurrentPageId(nextId);
              if (nextId) setItems(getPageItems(selectedProject.id, nextId) as GridItem[]); else setItems([]);
              setHistory(h => {
                let restoredId: string | null = null;
                const entry: HistoryEntry = {
                  label: 'Delete page',
                  undo: (items) => items,
                  redo: (items) => items,
                  onUndo: () => {
                    const nid = createPage(selectedProject.id);
                    if (nid) {
                      restoredId = nid;
                      renamePage(selectedProject.id, nid, title);
                      setPageItems(selectedProject.id, nid, snapItems.map(it => ({ id: it.id, x: it.x, y: it.y, w: it.w, h: it.h, z: it.z ?? 0, title: it.title, type: it.type, props: it.props, pinned: it.pinned, locked: it.locked })));
                      setCurrentPageId(nid);
                      setItems(getPageItems(selectedProject.id, nid) as GridItem[]);
                    }
                  },
                  onRedo: () => {
                    const target = restoredId || removedId;
                    if (target) {
                      deletePage(selectedProject.id, target);
                      const fallback = (selectedProject.pageOrder?.[0]) || null;
                      setCurrentPageId(fallback);
                      if (fallback) setItems(getPageItems(selectedProject.id, fallback) as GridItem[]);
                    }
                  },
                };
                return [...h, entry];
              });
              setRedoStack([]);
            }}
          />
        )}

        {/* Workspace */}
        <DndContext
          sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))}
          collisionDetection={rectIntersection}
          onDragStart={(event: DragStartEvent) => {
            const data = event.active.data.current as PaletteDrag;
            if (data?.src === 'palette') {
              setActiveDrag(data);
              const pointerEvent = event.activatorEvent as PointerEvent | undefined;
              if (pointerEvent && typeof pointerEvent.clientX === 'number' && typeof pointerEvent.clientY === 'number') {
                dragPointerStart.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
                const initialRect = event.active.rect.current.initial;
                if (initialRect) {
                  dragPointerOffset.current = {
                    x: pointerEvent.clientX - initialRect.left,
                    y: pointerEvent.clientY - initialRect.top,
                  };
                } else {
                  dragPointerOffset.current = null;
                }
              } else {
                dragPointerStart.current = null;
                dragPointerOffset.current = null;
              }
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
              const startPointer = dragPointerStart.current;
              const pointerX = startPointer ? startPointer.x + event.delta.x : initial.left + initial.width / 2 + event.delta.x;
              const pointerY = startPointer ? startPointer.y + event.delta.y : initial.top + initial.height / 2 + event.delta.y;
              const relX = pointerX - overRect.left;
              const relY = pointerY - overRect.top;

              // Compute grid coordinates using same math, then quantize to micro-step based on gap
              const effectiveZoom = zoom || 1;
              const colW = Math.floor(pageWidth / COLS);
              const baseUnit = Math.max(1, colW + gap);
              const baseX = baseUnit;
              const baseY = baseUnit; // square grid: row unit equals column unit
              const w = data.w ?? 4;
              const h = data.h ?? 4;
              const adjX = relX / effectiveZoom;
              const adjY = relY / effectiveZoom;
              let x = Math.floor(adjX / baseX);
              let y = Math.floor(adjY / baseY);
              x = Math.max(0, Math.min(x, COLS - w));
              y = Math.max(0, y);
              const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
              const ad = active.data.current as unknown as { type?: string };
              const newItem: GridItem = { id, x, y, w, h, title: data.label ?? 'Widget', z: 0, type: ad?.type, props: {}, pinned: false, locked: false };
              commitUpdate(`Add ${newItem.title}`, (prev) => {
                const norm = normalizeZ(prev);
                const maxZ = norm.length; // new item will be top
                return [...norm, { ...newItem, z: maxZ }];
              });
            }
            // Clear drag overlay when drop completes
            setActiveDrag(undefined);
            dragPointerStart.current = null;
            dragPointerOffset.current = null;
            dragOverlaySize.current = null;
          }}
          onDragCancel={() => {
            setActiveDrag(undefined);
            dragPointerStart.current = null;
            dragPointerOffset.current = null;
            dragOverlaySize.current = null;
          }}
        >
          {/* Visible drag preview while dragging from the palette */}
          <DragOverlay dropAnimation={null} modifiers={[dragOverlayCursorAlign]}>
            <DragOverlayPreview activeDrag={activeDrag} onMeasure={(size) => { dragOverlaySize.current = size; }} />
          </DragOverlay>
          <div className="grid gap-0 min-h-[28rem]" style={{ gridTemplateColumns: paletteCollapsed ? '1fr 1.5rem' : '1fr 16rem' }} onKeyDown={onKeyDown} tabIndex={0}>
            {/* Canvas or Preview inside a page-like viewport */}
            <ViewportSurface
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              setPageWidth={setPageWidth}
              setPageHeight={setPageHeight}
              heightMode={heightMode}
              previewMode={previewMode}
              cols={COLS}
              rowH={DEFAULT_ROW_H}
              gap={gap}
              items={items}
              onItemsChange={(next) => commitUpdate('Edit layout', () => next)}
              showGrid={showGrid}
              selectedId={selectedId}
              onSelect={setSelectedId}
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
              onMoveStart={() => { /* no-op */ }}
              onMoveEnd={(prevItem, nextItem) => {
                if (prevItem.x === nextItem.x && prevItem.y === nextItem.y) return;
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
              onDropAsset={(id, hash) => {
                // Only handle for Image widgets: set src to asset://hash
                commitUpdate('Set image from asset', (prev) => prev.map(it => it.id === id && it.type === 'image' ? { ...it, props: { ...(it.props as Record<string, unknown>), src: `asset://${hash}` } } : it));
              }}
              onNavigatePage={(pid) => {
                if (!selectedProject) return;
                setCurrentPageId(pid);
                try { localStorage.setItem(`py_current_page_${selectedProject.id}`, pid); } catch { /* ignore */ }
              }}
              currentPageId={currentPageId || undefined}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              onZoomChange={applyZoom}
            />

            {/* Widget Sidebar (collapsible) */}
            <aside className={`border-l border-[color:var(--border)] bg-[color:var(--bg)] relative ${previewMode ? 'opacity-50 pointer-events-none' : ''}`}>
              {paletteCollapsed ? (
                <div className="h-full flex items-center justify-center">
                  <button className="btn btn-ghost btn-xs rotate-180" title="Expand palette" onClick={togglePalette}>
                    <ChevronsLeft size={14} />
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between p-2 border-b border-[color:var(--border)] bg-[color:var(--muted)]/40">
                    <div className="text-xs text-[color:var(--fg-muted)]">CANVAS DASHBOARD</div>
                    <button className="btn btn-ghost btn-xs" title="Collapse palette" onClick={togglePalette}>
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                  <div className="p-2 overflow-auto grow space-y-3">
                    {/* Widgets section */}
                    <div className="border border-[color:var(--border)] rounded-md overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-[color:var(--muted)]/40 text-[10px] tracking-wide uppercase"
                        onClick={toggleWidgetsOpen}
                        title={widgetsOpen ? 'Collapse' : 'Expand'}
                      >
                        <span className="flex items-center gap-2">
                          {widgetsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          Widgets
                        </span>
                      </button>
                      {widgetsOpen && (
                        <div className="p-2">
                          <Suspense fallback={<div className="text-xs text-[color:var(--fg-muted)] p-2">Loading widgets…</div>}>
                            <WidgetsPalette />
                          </Suspense>
                        </div>
                      )}
                    </div>

                    {/* Assets section */}
                    <div className="border border-[color:var(--border)] rounded-md overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-[color:var(--muted)]/40 text-[10px] tracking-wide uppercase"
                        onClick={toggleAssetsOpen}
                        title={assetsOpen ? 'Collapse' : 'Expand'}
                      >
                        <span className="flex items-center gap-2">
                          {assetsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          Assets
                        </span>
                      </button>
                      {assetsOpen && (
                        <div className="p-2">
                          <AssetsPanel hideHeader />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </DndContext>
      </section>

      {/* Preview now replaces canvas above when toggled */}

      {/* Standalone popup window preview (renders current page) */}
      <PreviewPopup open={popupOpen} onClose={closeWebpage} title="PortfoliYOU – Preview" width={pageWidth} height={pageHeight}>
        <div style={{ width: pageWidth }}>
          <PagePreview width={pageWidth} cols={COLS} gap={gap} rowH={DEFAULT_ROW_H} items={items} currentPageId={currentPageId || undefined} onNavigatePage={(pid) => {
            if (!selectedProject) return;
            setCurrentPageId(pid);
            try { localStorage.setItem(`py_current_page_${selectedProject.id}`, pid); } catch { /* ignore */ }
          }} />
        </div>
      </PreviewPopup>

      {renameModalOpen && selectedProject && currentPageId && (
        <PageSettingsModal
          title="Page settings"
          initialName={renameOldTitle}
          initialStarter={renameInitialStarter}
          onCancel={() => setRenameModalOpen(false)}
          onSave={({ name, starter }) => {
            const trimmed = (name || '').trim();
            if (!trimmed) { setRenameModalOpen(false); return; }
            const oldTitle = renameOldTitle || 'Untitled';
            // Add history entry
            setHistory(h => {
              const entry: HistoryEntry = {
                label: 'Rename page',
                undo: (items) => items,
                redo: (items) => items,
                onUndo: () => { renamePage(selectedProject.id, currentPageId, oldTitle); },
                onRedo: () => { renamePage(selectedProject.id, currentPageId, trimmed); },
              } as HistoryEntry;
              return [...h, entry];
            });
            setRedoStack([]);
            renamePage(selectedProject.id, currentPageId, trimmed);
            // Update starter setting
            try { setPageStarter(selectedProject.id, currentPageId, Boolean(starter)); } catch { /* ignore */ }
            try {
              try { localStorage.setItem(`py_current_page_${selectedProject.id}`, currentPageId); } catch { /* ignore */ }
              setCurrentPageId(currentPageId);
              setItems(getPageItems(selectedProject.id, currentPageId) as GridItem[]);
            } catch { /* ignore */ }
            setRenameModalOpen(false);
          }}
          onDelete={() => {
            // close modal then delete page
            setRenameModalOpen(false);
            if (!selectedProject || !currentPageId) return;
            const total = selectedProject.pageOrder?.length ?? 0;
            if (total <= 1) {
              notify({ type: 'warn', message: 'A portfolio needs at least one page.', title: selectedProject.name, persistent: false });
              return;
            }
            deletePage(selectedProject.id, currentPageId);
            // pick next page
            const remaining = (selectedProject.pageOrder || []).filter(id => id !== currentPageId);
            const nextId = remaining[0] || null;
            setCurrentPageId(nextId);
            if (nextId) setItems(getPageItems(selectedProject.id, nextId) as GridItem[]); else setItems([]);
          }}
        />
      )}

      {editingItem && (
        <Suspense fallback={null}>
          <ModifyWidgetModal
            item={editingItem!}
            onClose={closeModify}
            onDelete={() => {
              // Delete the currently editing widget and close modal
              commitUpdate("Delete widget", (prev) => prev.filter(it => it.id === editingItem!.id ? false : true));
              closeModify();
            }}
            onRename={(v) => commitUpdate("Rename widget", (prev) => prev.map(it => it.id === editingItem!.id ? { ...it, title: v } : it))}
            onBringToFront={() => bringToFront(editingItem!.id)}
            onSendToBack={() => sendToBack(editingItem!.id)}
            onBringForward={() => bringForward(editingItem!.id)}
            onSendBackward={() => sendBackward(editingItem!.id)}
            onTogglePin={() => togglePin(editingItem!.id)}
            onToggleLock={() => toggleLock(editingItem!.id)}
            onApplyProps={(parsed) => commitUpdate("Update widget settings", (prev) => prev.map(it => it.id === editingItem!.id ? { ...it, props: parsed } : it))}
          />
        </Suspense>
      )}
    </div>
  );
}
