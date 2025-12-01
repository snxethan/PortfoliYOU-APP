import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect, lazy, Suspense } from "react";
import type { CSSProperties } from "react";
import { ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight, GripVertical, Settings, Palette } from "lucide-react";
import { DndContext, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, rectIntersection, DragOverlay, type Modifier } from "@dnd-kit/core";

import { useProjects } from "../providers/ProjectsProvider";
import { useNotifications } from '../providers/NotificationsProvider';
import { usePortfolioSettings } from "../providers/PortfolioSettingsProvider";
import type { GridItem } from "../components/editor/canvas/GridCanvas";
const ModifyWidgetModal = lazy(() => import("../components/editor/widgets/ModifyWidgetModal"));
const WidgetsPalette = lazy(() => import("../components/editor/widgets/WidgetsPalette"));
import PageSettingsModal from "../components/modals/PageSettingsModal";
import EditorSettings from "../components/editor/EditorSettings";
import PageSettings from "../components/editor/PageSettings";
import ViewportSurface from "../components/editor/ViewportSurface";
import DragOverlayPreview from "../components/editor/DragOverlayPreview";
import AssetsPanel from "../components/editor/widgets/AssetsPanel";
import PreviewPopup from "../components/editor/PreviewPopup";
import PagePreview from "../components/editor/PagePreview";
import { usePersistentFlag } from "../hooks/usePersistentFlag";
import { getWidgetThemeSnapshot } from "../widgets/theme";
import type { SelectionChangeOptions, MarqueeSelectionOptions } from "../components/editor/selection";
import { WidgetsRegistry } from "../widgets/registry";

const COLS = 12;
const DEFAULT_ROW_H = 32; // px height per row (content area)
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.75;
const CLIPBOARD_MARKER_MULTI = 'PORTFOLIYOU:WIDGETS:v2\n';
const CLIPBOARD_MARKER_SINGLE = 'PORTFOLIYOU:WIDGET:v1\n';

function serializeClipboardItems(list: GridItem[]): string | null {
  try {
    const seen = new WeakSet();
    return JSON.stringify(list, (_key, value) => {
      if (typeof value === 'function') return undefined;
      if (typeof value === 'bigint') return value.toString();
      if (value && typeof value === 'object') {
        if (seen.has(value as object)) return undefined;
        seen.add(value as object);
      }
      return value;
    });
  } catch {
    return null;
  }
}

function serializeGridItems(list: GridItem[]) {
  return list.map(it => ({
    id: it.id,
    x: it.x, y: it.y, w: it.w, h: it.h,
    z: typeof it.z === 'number' ? it.z : 0,
    title: it.title, type: it.type, props: it.props,
    schemaVersion: typeof it.schemaVersion === 'number' ? it.schemaVersion : 1,
    pinned: it.pinned, locked: it.locked,
  }));
}

export default function EditorPage() {
  const { selectedProject, createPage, deletePage, renamePage, getPageItems, setPageItems, setPageStarter, setPageBackground, activeTheme, updateTheme } = useProjects();
  const { add: notify } = useNotifications();
  const { openSettings } = usePortfolioSettings();

  const notifyWidgetChange = useCallback((action: 'create' | 'delete', label?: string) => {
    const title = (label && label.trim()) || 'Widget';
    const message = action === 'create' ? `Widget "${title}" added` : `Widget "${title}" removed`;
    const type = action === 'create' ? 'success' : 'info';
    try { notify({ type, message, title: selectedProject?.name, persistent: false }); } catch { /* noop */ }
  }, [notify, selectedProject?.name]);

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

  const currentPage = currentPageId && selectedProject ? selectedProject.pages[currentPageId] : null;
  const themeBackground = activeTheme?.colors.background || '#ffffff';
  const pageBackground = currentPage?.backgroundColor && currentPage.backgroundColor.trim() ? currentPage.backgroundColor : null;
  const effectivePageBackground = pageBackground || themeBackground;
  const widgetThemeSnapshot = useMemo(() => getWidgetThemeSnapshot(activeTheme), [activeTheme]);

  // Page settings modal state
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameOldTitle, setRenameOldTitle] = useState<string>("");
  const [renameInitialStarter, setRenameInitialStarter] = useState<boolean>(false);

  // Gap between cells (both x and y), in pixels
  const [gap, setGap] = useState<number>(12);

  // Demo items to drag around the canvas
  const [items, setItems] = useState<GridItem[]>([]);
  const itemsRef = useRef<GridItem[]>([]);
  const lastPersistedSignatureRef = useRef<string | null>(null);
  const snapshotSignature = useCallback((list: GridItem[]) => JSON.stringify(serializeGridItems(list)), []);
  const suppressHydrateRef = useRef(false);
  const replaceItems = useCallback((next: GridItem[]) => {
    itemsRef.current = next;
    setItems(next);
    lastPersistedSignatureRef.current = snapshotSignature(next);
  }, [snapshotSignature]);
  const persistItems = useCallback((snapshot?: GridItem[]) => {
    if (!selectedProject || !currentPageId) return;
    try {
      suppressHydrateRef.current = true;
      const source = snapshot ?? itemsRef.current;
      const serialized = serializeGridItems(source);
      const signature = JSON.stringify(serialized);
      if (lastPersistedSignatureRef.current === signature) {
        suppressHydrateRef.current = false;
        return;
      }
      setPageItems(selectedProject.id, currentPageId, serialized);
      lastPersistedSignatureRef.current = signature;
    } catch {
      suppressHydrateRef.current = false;
    }
  }, [selectedProject?.id, currentPageId, setPageItems]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    const handleBeforeUnload = () => { persistItems(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      persistItems();
    };
  }, [persistItems]);

  const getPageItemsRef = useRef(getPageItems);
  useEffect(() => { getPageItemsRef.current = getPageItems; }, [getPageItems]);

  const currentPageRevision = selectedProject && currentPageId
    ? (selectedProject.pages?.[currentPageId]?.updatedAt ?? null)
    : null;

  // Load items from provider whenever project/page changes or page data updates
  useEffect(() => {
    if (!selectedProject || !currentPageId) {
      suppressHydrateRef.current = false;
      replaceItems([]);
      return;
    }
    if (suppressHydrateRef.current) {
      suppressHydrateRef.current = false;
      return;
    }
    const getter = getPageItemsRef.current;
    if (!getter) return;
    const loaded = getter(selectedProject.id, currentPageId) as GridItem[];
    replaceItems(loaded);
  }, [selectedProject?.id, currentPageId, currentPageRevision, replaceItems]);

  const presentWidgetTypes = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (typeof it.type === 'string' && it.type) {
        set.add(it.type);
      }
    }
    return Array.from(set);
  }, [items]);

  useEffect(() => {
    if (!presentWidgetTypes.length) return;
    presentWidgetTypes.forEach((type) => {
      try { void WidgetsRegistry.ensure(type); } catch { /* ignore */ }
    });
  }, [presentWidgetTypes]);

  // Simple undo/redo stacks (keep last 50 operations)
  type ItemsUpdater = (prev: GridItem[]) => GridItem[];
  type HistoryEntry = { label: string; undo: ItemsUpdater; redo: ItemsUpdater; onUndo?: () => void; onRedo?: () => void };
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const commitUpdate = useCallback((label: string, makeNext: ItemsUpdater) => {
    setItems(prev => {
      const next = makeNext(prev);
      itemsRef.current = next;
      setHistory(h => {
        const entry: HistoryEntry = { label, undo: () => prev, redo: () => next };
        const nh = [...h, entry];
        return nh.length > MAX_HISTORY ? nh.slice(nh.length - MAX_HISTORY) : nh;
      });
      setRedoStack([]);
      persistItems(next);
      return next;
    });
  }, [persistItems]);

  function undo() {
    setItems(prev => {
      if (history.length === 0) return prev;
      const entry = history[history.length - 1];
      const undone = entry.undo(prev);
      itemsRef.current = undone;
      persistItems(undone);
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
      itemsRef.current = redone;
      persistItems(redone);
      setRedoStack(r => r.slice(0, -1));
      setHistory(h => [...h, entry]);
      entry.onRedo?.();
      try { notify({ type: 'info', message: `Redid: ${entry.label}`, title: selectedProject?.name, persistent: false }); } catch { /* noop */ }
      return redone;
    });
  }

  const canUndo = history.length > 0;
  const canRedo = redoStack.length > 0;
  const handleItemMoveStart = useCallback(() => {
    // reserved for future hooks (e.g., showing drag UI state)
  }, []);
  const handleItemMoveEnd = useCallback((prevItem: GridItem, nextItem: GridItem) => {
    if (
      prevItem.x === nextItem.x &&
      prevItem.y === nextItem.y &&
      prevItem.w === nextItem.w &&
      prevItem.h === nextItem.h
    ) {
      return;
    }
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
    persistItems();
  }, [persistItems, setHistory, setRedoStack]);

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
  const [paletteWidth, setPaletteWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem('py_palette_w')) || 320; } catch { return 320; }
  });
  const paletteMinWidth = 260;
  const paletteMaxWidth = 520;
  // Allow the palette to be reduced smaller while still enforcing a sensible minimum
  // Lowered from 260 to 200 to allow smaller dashboards when requested.
  // Adjust this value if you want a different minimum width.
  // NOTE: keep in sync with UI expectations.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _paletteMinHint = 200;
  function togglePalette() {
    setPaletteCollapsed(prev => !prev);
  }
  const paletteRef = useRef<HTMLDivElement | null>(null);

  const beginResizePalette = useCallback((event: React.PointerEvent | PointerEvent) => {
    const ev = event as PointerEvent;
    try { ev.preventDefault?.(); } catch { /* ignore */ }
    try { ev.stopPropagation?.(); } catch { /* ignore */ }
    // If the palette is collapsed, expand it before resizing and use a sensible start width
    if (paletteCollapsed) {
      setPaletteCollapsed(false);
    }
    const startX = ev.clientX;
    const startWidth = Math.max(paletteMinWidth, paletteWidth || 200);
    const handleMove = (move: PointerEvent) => {
      // For a right-side sidebar, moving pointer left should increase palette width,
      // so compute delta relative to the startX accordingly.
      const delta = startX - move.clientX;
      const next = Math.min(paletteMaxWidth, Math.max(paletteMinWidth, Math.round(startWidth + delta)));
      setPaletteWidth(next);
      try { localStorage.setItem('py_palette_w', String(Math.round(next))); } catch { /* ignore */ }
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [paletteCollapsed, paletteWidth, paletteMaxWidth, paletteMinWidth]);
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<GridItem[] | null>(null);
  const primarySelectedId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  const handleSelect = useCallback((id: string | null, opts?: SelectionChangeOptions) => {
    setSelectedIds((prev) => {
      if (!id) {
        if (opts?.append || opts?.toggle) return prev;
        return [];
      }
      if (opts?.toggle) {
        if (prev.includes(id)) return prev.filter(existing => existing !== id);
        return [...prev, id];
      }
      if (opts?.append) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return [id];
    });
  }, []);

  const handleMarqueeSelect = useCallback((ids: string[], opts?: MarqueeSelectionOptions) => {
    if (!ids || ids.length === 0) {
      if (!opts?.append) setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      if (opts?.append) {
        const merged = [...prev];
        ids.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        return merged;
      }
      return [...ids];
    });
  }, []);

  function withSelected(mut: (it: GridItem) => GridItem | GridItem[] | null, label: string) {
    if (!primarySelectedId) return;
    const src = items.find(i => i.id === primarySelectedId);
    if (!src) return;
    const result = mut(src);
    if (!result) return;
    if (Array.isArray(result)) {
      commitUpdate(label, () => result);
    } else {
      commitUpdate(label, (prev) => prev.map(i => i.id === primarySelectedId ? result : i));
    }
  }

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.length) return prev;
      const existingIds = new Set(items.map((it) => it.id));
      const next = prev.filter((id) => existingIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [items]);
  async function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Do not interfere with typing in inputs/textareas
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute('contenteditable') === 'true')) return;
    // Movement
    if (selectedIds.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      const selectedSet = new Set(selectedIds);
      commitUpdate(selectedIds.length > 1 ? 'Nudge widgets' : 'Nudge widget', (prev) => {
        let changed = false;
        const next = prev.map((it) => {
          if (!selectedSet.has(it.id) || it.pinned || it.locked) return it;
          const nx = Math.max(0, Math.min(it.x + dx, COLS - it.w));
          const ny = Math.max(0, it.y + dy);
          if (nx === it.x && ny === it.y) return it;
          changed = true;
          return { ...it, x: nx, y: ny };
        });
        return changed ? next : prev;
      });
      return;
    }
    // Delete
    if (selectedIds.length && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      const selectedSet = new Set(selectedIds);
      const removed: GridItem[] = [];
      commitUpdate('Delete items', (prev) => {
        prev.forEach((item) => { if (selectedSet.has(item.id)) removed.push(item); });
        if (!removed.length) return prev;
        return prev.filter((item) => !selectedSet.has(item.id));
      });
      removed.forEach((item) => notifyWidgetChange('delete', item.title));
      setSelectedIds([]);
      return;
    }
    // Copy/Cut/Paste/Duplicate
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === 'c' && selectedIds.length) {
      e.preventDefault();
      const selectedSet = new Set(selectedIds);
      const snapshot = items.filter((it) => selectedSet.has(it.id)).map((it) => ({ ...it }));
      if (!snapshot.length) return;
      setClipboard(snapshot);
      try {
        const payload = serializeClipboardItems(snapshot);
        if (payload !== null) {
          if (window.api?.clipboardWrite) {
            void window.api.clipboardWrite({ text: CLIPBOARD_MARKER_MULTI + payload });
          } else {
            try { navigator.clipboard?.writeText(CLIPBOARD_MARKER_MULTI + payload); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      return;
    }
    if (meta && e.key.toLowerCase() === 'x' && selectedIds.length) {
      e.preventDefault();
      const selectedSet = new Set(selectedIds);
      const snapshot = items.filter((it) => selectedSet.has(it.id)).map((it) => ({ ...it }));
      if (!snapshot.length) return;
      setClipboard(snapshot);
      try {
        const payload = serializeClipboardItems(snapshot);
        if (payload !== null) {
          if (window.api?.clipboardWrite) {
            void window.api.clipboardWrite({ text: CLIPBOARD_MARKER_MULTI + payload });
          } else {
            try { navigator.clipboard?.writeText(CLIPBOARD_MARKER_MULTI + payload); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      const removedTitles: string[] = [];
      commitUpdate('Cut items', (prev) => {
        prev.forEach((item) => { if (selectedSet.has(item.id)) removedTitles.push(item.title); });
        if (!removedTitles.length) return prev;
        return prev.filter((item) => !selectedSet.has(item.id));
      });
      removedTitles.forEach((title) => notifyWidgetChange('delete', title));
      setSelectedIds([]);
      return;
    }
    if (meta && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      // Delegate to async paste handler so we can await clipboard in a safe scope
      void handlePasteFromClipboard();
      return;
    }
    // Async paste helper (declared just before next keyboard cases)
    async function handlePasteFromClipboard() {
      // Try system clipboard first
      let payloadText: string | null = null;
      try {
        if (window.api?.clipboardRead) {
          const res = await window.api.clipboardRead();
          if (res && res.ok && typeof res.text === 'string') payloadText = res.text;
        } else {
          try { payloadText = await navigator.clipboard?.readText(); } catch { payloadText = null; }
        }
      } catch { payloadText = null; }

      let clipboardItems: GridItem[] | null = null;
      if (payloadText && payloadText.startsWith(CLIPBOARD_MARKER_MULTI)) {
        try { clipboardItems = JSON.parse(payloadText.slice(CLIPBOARD_MARKER_MULTI.length)); } catch { clipboardItems = null; }
      } else if (payloadText && payloadText.startsWith(CLIPBOARD_MARKER_SINGLE)) {
        try {
          const legacy = JSON.parse(payloadText.slice(CLIPBOARD_MARKER_SINGLE.length));
          clipboardItems = legacy ? [legacy] : null;
        } catch { clipboardItems = null; }
      }
      // Fallback to in-memory clipboard state
      if (!clipboardItems || clipboardItems.length === 0) {
        clipboardItems = clipboard ? clipboard.map((it) => ({ ...it })) : null;
      }
      if (!clipboardItems || clipboardItems.length === 0) return;
      const createdIds: string[] = [];
      const clones = clipboardItems.map((item, idx) => {
        const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
        createdIds.push(nid);
        const width = Math.max(1, item.w ?? 1);
        const height = Math.max(1, item.h ?? 1);
        const offset = idx + 1;
        const nx = Math.max(0, Math.min((item.x ?? 0) + offset, COLS - width));
        const ny = Math.max(0, (item.y ?? 0) + offset);
        return { ...item, id: nid, x: nx, y: ny, w: width, h: height, title: ((item.title || 'Widget') + ' copy') };
      });
      commitUpdate(clones.length > 1 ? 'Paste items' : 'Paste item', (prev) => {
        const norm = normalizeZ(prev);
        let nextZ = norm.length;
        const stamped = clones.map((clone) => ({ ...clone, z: nextZ++ }));
        return [...norm, ...stamped];
      });
      clones.forEach((clone) => notifyWidgetChange('create', clone.title));
      setSelectedIds(createdIds);
    }

    if (meta && e.key.toLowerCase() === 'd' && selectedIds.length) {
      e.preventDefault();
      const selectedSet = new Set(selectedIds);
      const sourceItems = items.filter((it) => selectedSet.has(it.id));
      if (!sourceItems.length) return;
      const duplicatedIds: string[] = [];
      const duplicates = sourceItems.map((src, idx) => {
        const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
        duplicatedIds.push(nid);
        const nx = Math.min(COLS - src.w, src.x + 1 + idx);
        const ny = src.y + 1 + idx;
        return { ...src, id: nid, x: Math.max(0, nx), y: Math.max(0, ny), title: `${src.title} copy` };
      });
      commitUpdate(duplicates.length > 1 ? 'Duplicate items' : 'Duplicate item', (prev) => {
        const norm = normalizeZ(prev);
        let nextZ = norm.length;
        const stamped = duplicates.map((dup) => ({ ...dup, z: nextZ++ }));
        return [...norm, ...stamped];
      });
      duplicates.forEach((dup) => notifyWidgetChange('create', dup.title));
      setSelectedIds(duplicatedIds);
      return;
    }
  }

  // Active drag preview for palette items
  type PaletteDrag = { src?: string; type?: string; label?: string; w?: number; h?: number; schemaVersion?: number } | undefined;
  const [activeDrag, setActiveDrag] = useState<PaletteDrag>(undefined);
  const dragPointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragPointerLast = useRef<{ x: number; y: number } | null>(null);
  const dragOverlaySize = useRef<{ width: number; height: number } | null>(null);
  const dragPointerOffset = useRef<{ x: number; y: number } | null>(null);

  const dragOverlayCursorAlign = useMemo<Modifier>(() => (({ transform, activeNodeRect }) => {
    if (!transform) return transform;
    const pointer = dragPointerLast.current || dragPointerStart.current;
    if (!pointer) return transform;
    const overlaySize = dragOverlaySize.current;
    const fallbackHalfW = activeNodeRect ? activeNodeRect.width / 2 : 0;
    const fallbackHalfH = activeNodeRect ? activeNodeRect.height / 2 : 0;
    const offset = dragPointerOffset.current;
    const halfW = offset ? offset.x : (overlaySize ? overlaySize.width / 2 : fallbackHalfW);
    const halfH = offset ? offset.y : (overlaySize ? overlaySize.height / 2 : fallbackHalfH);
    // transform.x/y are offsets applied to the active node's initial position (activeNodeRect.left/top)
    // Compute the required transform so the overlay's top-left equals pointer - half size.
    const baseLeft = activeNodeRect ? activeNodeRect.left : 0;
    const baseTop = activeNodeRect ? activeNodeRect.top : 0;
    return {
      ...transform,
      x: pointer.x - halfW - baseLeft,
      y: pointer.y - halfH - baseTop,
    };
  }) as Modifier, []);

  // Measure canvas viewport height so sidebar can be constrained to it
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasHeightPx, setCanvasHeightPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    function measure() {
      const el = canvasWrapperRef.current;
      if (!el) { setCanvasHeightPx(null); return; }
      const h = Math.round(el.getBoundingClientRect().height);
      setCanvasHeightPx(h);
    }
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    const target = canvasWrapperRef.current;
    if (ro && target) ro.observe(target);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) {
        try { ro.disconnect(); } catch { /* ignore */ }
      }
      window.removeEventListener('resize', measure);
    };
  }, [pageWidth, pageHeight, zoom, paletteWidth, paletteCollapsed]);
  const palettePanelStyle: CSSProperties | undefined = canvasHeightPx ? { height: `${canvasHeightPx}px` } : undefined;

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
    setSelectedIds([]);
    setEditingId(null);
  }, [selectedProject?.id, currentPageId]);

  useEffect(() => {
    setClipboard(null);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!editingId) return;
    if (!items.some(it => it.id === editingId)) {
      setEditingId(null);
    }
  }, [items, editingId]);

  // Keyboard add fallback from palette tiles
  useEffect(() => {
    function onAddWidget(e: Event) {
      const ce = e as CustomEvent<{ type: string; label?: string; w?: number; h?: number; schemaVersion?: number }>;
      const defW = Math.max(1, Math.min(COLS, ce.detail?.w ?? 4));
      const defH = Math.max(1, ce.detail?.h ?? 4);
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
      const schemaVersion = typeof ce.detail?.schemaVersion === 'number' ? ce.detail.schemaVersion : 1;
      const newItem: GridItem = { id, x: 0, y: 0, w: defW, h: defH, z: 0, title: ce.detail?.label || 'Widget', type: ce.detail?.type, props: {}, schemaVersion, pinned: false, locked: false };
      commitUpdate(`Add ${newItem.title}`, (prev) => {
        const norm = normalizeZ(prev);
        const maxZ = norm.length;
        return [...norm, { ...newItem, z: maxZ }];
      });
      notifyWidgetChange('create', newItem.title);
      setSelectedIds([id]);
    }
    window.addEventListener('py:addWidget', onAddWidget as EventListener);
    return () => window.removeEventListener('py:addWidget', onAddWidget as EventListener);
  }, [commitUpdate, notifyWidgetChange]);

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
    <div className="p-6 space-y-6">
      {!selectedProject && (
        <div className="surface p-4 border border-[color:var(--border)] text-sm text-[color:var(--fg-muted)]">
          No portfolio selected. Go to Home and open one.
        </div>
      )}

      <section className="surface border border-[color:var(--border)] rounded-2xl p-6 shadow-lg shadow-black/20 overflow-hidden">
        {/* Workspace label */}
        <p className="section-title">Portfolio Editor workspace</p>
        <p className="text-sm text-[color:var(--fg-muted)]">Edit, manage and build your portfolio in a single workspace.</p>

        <div className="mt-4 space-y-4">
          {/* Editor Settings subsection */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Editor Settings</p>
              <p className="text-sm text-[color:var(--fg-muted)]">Controls for canvas, zoom and editor preferences.</p>
            </div>
            <div className="mt-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
                <div className="w-full">
                  <EditorSettings
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
                </div>
              </div>
            </div>
          </div>

          {/* Page Settings subsection */}
          {selectedProject && (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Page Settings</p>
                <p className="text-sm text-[color:var(--fg-muted)]">Manage pages, backgrounds and quick page actions.</p>
              </div>
              <div className="mt-4">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
                  <div className="w-full">
                    <PageSettings
                      isCloud={!!(selectedProject as unknown as { _cloudId?: string })._cloudId}
                      pageOrder={selectedProject.pageOrder || []}
                      pages={selectedProject.pages}
                      currentPageId={currentPageId}
                      pageBackground={pageBackground}
                      themeBackground={themeBackground}
                      onQuickBackgroundChange={(color) => {
                        if (!selectedProject || !currentPageId) return;
                        setPageBackground(selectedProject.id, currentPageId, color);
                      }}
                      onOpenThemeSettings={selectedProject ? () => openSettings({ projectId: selectedProject.id, section: "theme" }) : undefined}
                      onSelectPage={(id) => {
                        setCurrentPageId(id);
                        if (selectedProject && id) {
                          try { localStorage.setItem(`py_current_page_${selectedProject.id}`, id); } catch { /* ignore */ }
                          replaceItems(getPageItems(selectedProject.id, id) as GridItem[]);
                        } else {
                          replaceItems([]);
                        }
                      }}
                      onCreatePage={() => {
                        if (!selectedProject) return;
                        const prevId = currentPageId;
                        const id = createPage(selectedProject.id) || null;
                        if (id) {
                          setCurrentPageId(id);
                          try { localStorage.setItem(`py_current_page_${selectedProject.id}`, id); } catch { /* ignore */ }
                          replaceItems([]);
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
                                  replaceItems(loaded);
                                }
                              },
                              onRedo: () => {
                                const newId = createPage(selectedProject.id);
                                if (newId) {
                                  setCurrentPageId(newId);
                                  replaceItems([]);
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
                        try { replaceItems(getPageItems(selectedProject.id, currentPageId) as GridItem[]); } catch { /* ignore */ }
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
                        if (nextId) replaceItems(getPageItems(selectedProject.id, nextId) as GridItem[]); else replaceItems([]);
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
                                setPageItems(selectedProject.id, nid, serializeGridItems(snapItems));
                                setCurrentPageId(nid);
                                replaceItems(getPageItems(selectedProject.id, nid) as GridItem[]);
                              }
                            },
                            onRedo: () => {
                              const target = restoredId || removedId;
                              if (target) {
                                deletePage(selectedProject.id, target);
                                const fallback = (selectedProject.pageOrder?.[0]) || null;
                                setCurrentPageId(fallback);
                                if (fallback) replaceItems(getPageItems(selectedProject.id, fallback) as GridItem[]);
                              }
                            },
                          };
                          return [...h, entry];
                        });
                        setRedoStack([]);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Portfolio Canvas subsection (contains canvas and dashboard) */}
          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Portfolio Canvas</p>
              <p className="text-sm text-[color:var(--fg-muted)]">Canvas and dashboard for arranging pages and widgets.</p>
            </div>
            <div className="mt-4">
              <DndContext
                sensors={useSensors(
                  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
                  useSensor(MouseSensor),
                  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
                )}
                collisionDetection={rectIntersection}
                onDragStart={(event: DragStartEvent) => {
                  const data = event.active.data.current as PaletteDrag;
                  try { console.debug('[py:dnd] dragstart activeId=', event.active.id, 'data=', data); } catch { /* ignore */ }
                  if (data?.src === 'palette') {
                    setActiveDrag(data);
                    const pointerEvent = event.activatorEvent as PointerEvent | undefined;
                    if (pointerEvent && typeof pointerEvent.clientX === 'number' && typeof pointerEvent.clientY === 'number') {
                      dragPointerStart.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
                      dragPointerLast.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
                      const nodeRect = event.active.rect.current?.initial;
                      if (nodeRect) {
                        dragPointerOffset.current = {
                          x: pointerEvent.clientX - nodeRect.left,
                          y: pointerEvent.clientY - nodeRect.top,
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
                onDragMove={(event) => {
                  try { console.debug('[py:dnd] dragmove delta=', event.delta, 'activeId=', event.active?.id); } catch { /* ignore */ }
                  if (dragPointerStart.current) {
                    dragPointerLast.current = {
                      x: dragPointerStart.current.x + event.delta.x,
                      y: dragPointerStart.current.y + event.delta.y,
                    };
                  } else {
                    const pointerEvent = event.activatorEvent as PointerEvent | undefined;
                    if (pointerEvent && typeof pointerEvent.clientX === 'number' && typeof pointerEvent.clientY === 'number') {
                      dragPointerLast.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
                    }
                  }
                }}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  try { console.debug('[py:dnd] dragend active=', active?.id, 'over=', over?.id); } catch { /* ignore */ }
                  if (!over) {
                    try { console.debug('[py:dnd] dragend: no droppable target'); } catch { /* ignore */ }
                    setActiveDrag(undefined);
                    dragPointerStart.current = null;
                    dragPointerLast.current = null;
                    dragOverlaySize.current = null;
                    dragPointerOffset.current = null;
                    return;
                  }
                  const data = active.data.current as { src?: string; type?: string; label?: string; w?: number; h?: number; schemaVersion?: number } | undefined;
                  if (data?.src === 'palette' && over.id === 'grid-canvas') {
                    const overRect = over.rect;
                    const initial = active.rect.current.initial;
                    if (!initial) return;
                    const pointerRef = dragPointerLast.current || dragPointerStart.current;
                    const pointerX = pointerRef ? pointerRef.x : initial.left + initial.width / 2 + event.delta.x;
                    const pointerY = pointerRef ? pointerRef.y : initial.top + initial.height / 2 + event.delta.y;
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
                    const schemaVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
                    const newItem: GridItem = { id, x, y, w, h, title: data.label ?? 'Widget', z: 0, type: ad?.type, props: {}, schemaVersion, pinned: false, locked: false };
                    commitUpdate(`Add ${newItem.title}`, (prev) => {
                      const norm = normalizeZ(prev);
                      const maxZ = norm.length; // new item will be top
                      return [...norm, { ...newItem, z: maxZ }];
                    });
                    notifyWidgetChange('create', newItem.title);
                  }
                  // Clear drag overlay when drop completes
                  setActiveDrag(undefined);
                  dragPointerStart.current = null;
                  dragPointerLast.current = null;
                  dragOverlaySize.current = null;
                  dragPointerOffset.current = null;
                }}
                onDragCancel={() => {
                  setActiveDrag(undefined);
                  dragPointerStart.current = null;
                  dragPointerLast.current = null;
                  dragOverlaySize.current = null;
                  dragPointerOffset.current = null;
                }}
              >
                {/* Visible drag preview while dragging from the palette */}
                <DragOverlay dropAnimation={null} modifiers={[dragOverlayCursorAlign]}>
                  <DragOverlayPreview activeDrag={activeDrag} onMeasure={(size) => { dragOverlaySize.current = size; }} />
                </DragOverlay>
                <div
                  className="h-full grid gap-0 min-h-[28rem] items-stretch"
                  style={{
                    gridTemplateColumns: paletteCollapsed ? 'minmax(0,1fr) 32px' : `minmax(0,1fr) ${Math.round(paletteWidth)}px`,
                  }}
                  onKeyDown={onKeyDown}
                  tabIndex={0}
                >
                  {/* Canvas or Preview inside a page-like viewport */}
                  <div
                    className="h-full min-h-0"
                    ref={canvasWrapperRef}
                    onPointerDown={(e) => {
                      // allow starting a resize when clicking on the canvas near the right edge
                      try {
                        const el = canvasWrapperRef.current;
                        if (!el) return;
                        const rect = el.getBoundingClientRect();
                        const distFromRight = rect.right - e.clientX;
                        // if pointer is within 48px of the canvas right edge, start resize
                        if (distFromRight <= 48 && distFromRight >= 0) {
                          beginResizePalette(e as unknown as PointerEvent);
                        }
                      } catch { /* ignore */ }
                    }}
                  >
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
                      onItemsChange={replaceItems}
                      showGrid={showGrid}
                      selectedIds={selectedIds}
                      onSelect={handleSelect}
                      onMarqueeSelect={handleMarqueeSelect}
                      onDelete={(id) => {
                        let removedTitle: string | undefined;
                        commitUpdate("Delete item", (prev) => {
                          const tgt = prev.find(i => i.id === id);
                          if (!tgt) return prev;
                          removedTitle = tgt.title;
                          return prev.filter((it) => it.id !== id);
                        });
                        if (removedTitle) notifyWidgetChange('delete', removedTitle);
                      }}
                      onDuplicate={(id) => {
                        let duplicateTitle: string | undefined;
                        commitUpdate("Duplicate item", (prev) => {
                          const src = prev.find((it) => it.id === id);
                          if (!src) return prev;
                          duplicateTitle = src.title + " copy";
                          const nid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
                          const nx = Math.min(COLS - src.w, src.x + 1);
                          const ny = src.y + 1;
                          const norm = normalizeZ(prev);
                          const maxZ = norm.length; // place duplicate on top
                          return [...norm, { ...src, id: nid, x: nx, y: ny, title: duplicateTitle, z: maxZ }];
                        });
                        if (duplicateTitle) notifyWidgetChange('create', duplicateTitle);
                      }}
                      onMoveStart={handleItemMoveStart}
                      onMoveEnd={handleItemMoveEnd}
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
                      pageBackground={effectivePageBackground}
                      theme={activeTheme}
                      themeSnapshot={widgetThemeSnapshot}
                    />
                  </div>

                  {/* Widget Sidebar (collapsible) */}
                  <aside
                    className={`relative surface p-4 border border-[color:var(--border)] rounded-2xl shadow-lg bg-[color:var(--surface)]/80 overflow-hidden ${previewMode ? 'opacity-50 pointer-events-none' : ''} flex flex-col palette-full-height`}
                    style={palettePanelStyle}
                    onPointerDown={(e) => {
                      // allow starting a resize when pointer is near the left edge of the aside
                      const el = paletteRef.current || (e.currentTarget as HTMLElement);
                      const rect = el ? (el.getBoundingClientRect ? el.getBoundingClientRect() : null) : null;
                      if (!rect) return;
                      const localX = e.clientX - rect.left;
                      // use an expanded threshold so users can start dragging from the outer section/header area
                      if (localX <= 48) {
                        beginResizePalette(e as unknown as PointerEvent);
                      }
                    }}
                  >
                    {paletteCollapsed ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={togglePalette}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePalette(); } }}
                        className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
                        title="Expand widget sidebar"
                      >
                        <ChevronsLeft size={16} />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col relative">
                        <div
                          ref={paletteRef}
                          className="absolute top-0 bottom-0 w-10 cursor-ew-resize z-10 flex items-center justify-center text-[color:var(--fg-muted)] no-touch-action"
                          style={{ left: '-12px' }}
                          onPointerDown={beginResizePalette}
                          role="presentation"
                          title="Resize dashboard"
                        >
                          <span className="sr-only">Resize sidebar</span>
                          <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-1 shadow-sm">
                            <GripVertical size={14} />
                          </div>
                        </div>
                        <div
                          className="px-3 pt-4 pb-3 relative palette-header"
                          onPointerDown={(e) => {
                            // start resize when pointer is near the left edge (wider hit area)
                            const el = paletteRef.current || (e.currentTarget && (e.currentTarget as HTMLElement).closest('.palette-full-height') as HTMLElement | null);
                            const rect = el ? el.getBoundingClientRect() : null;
                            if (!rect) return;
                            const localX = e.clientX - rect.left;
                            // allow a larger area to initiate resize so it's convenient from the outer section
                            if (localX <= 48) {
                              beginResizePalette(e as unknown as PointerEvent);
                            }
                          }}
                        >
                          <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Canvas Dashboard</p>
                          <button
                            className="absolute right-2 top-1 btn btn-ghost btn-xs p-1"
                            title="Collapse palette"
                            onClick={togglePalette}
                            aria-label="Collapse widget palette"
                          >
                            <ChevronsRight size={14} />
                          </button>
                        </div>
                        <div className="p-2 overflow-auto grow space-y-3 scrollable scrollable-container">
                          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 shadow-sm">
                            <div className="px-4 pt-1 pb-1">
                              <button
                                className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left"
                                onClick={toggleWidgetsOpen}
                                title={widgetsOpen ? 'Collapse widgets' : 'Expand widgets'}
                              >
                                <div className="flex items-center gap-2">
                                  {(widgetsOpen) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Widgets</p>
                                </div>
                                <div className="text-[color:var(--fg-muted)]" />
                              </button>
                            </div>
                            {widgetsOpen && (
                              <div className="p-3 pt-0">
                                <Suspense fallback={<div className="text-xs text-[color:var(--fg-muted)] p-2">Loading widgets…</div>}>
                                  <WidgetsPalette />
                                </Suspense>
                              </div>
                            )}
                          </section>

                          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 shadow-sm">
                            <div className="px-4 pt-1 pb-1">
                              <button
                                className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left"
                                onClick={toggleAssetsOpen}
                                title={assetsOpen ? 'Collapse assets' : 'Expand assets'}
                              >
                                <div className="flex items-center gap-2">
                                  {assetsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Assets</p>
                                </div>
                                <div className="text-[color:var(--fg-muted)]" />
                              </button>
                            </div>
                            {assetsOpen && (
                              <div className="p-3 pt-0">
                                <AssetsPanel hideHeader />
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </DndContext>
            </div>
          </div>
        </div>
      </section>

      {/* Theme subsection under Portfolio Canvas */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
        <div className="w-full">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Theme</p>
            <p className="text-sm text-[color:var(--fg-muted)]">Current theme applied to the canvas and widgets.</p>
          </div>

          {/* Current theme + settings subsection */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">Current theme</p>
                <p className="mt-1 text-sm">{activeTheme?.name ?? 'Default'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md border border-[color:var(--border)]" style={{ background: activeTheme?.colors?.primary || '#111827' }} title="Primary color" />
                <div className="w-8 h-8 rounded-md border border-[color:var(--border)]" style={{ background: activeTheme?.colors?.secondary || '#f3f4f6' }} title="Secondary color" />
              </div>
              <div>
                <button
                  className="btn btn-ghost btn-sm flex items-center gap-2"
                  onClick={() => { if (selectedProject) openSettings({ projectId: selectedProject.id, section: 'theme' }); }}
                  title="Open theme settings"
                >
                  <Settings size={14} />
                  <span>Theme settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Color hex controls subsection */}
          {activeTheme && selectedProject && (
            <div className="mt-4 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">Colors</p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(activeTheme.colors).map((k) => {
                  const key = k as keyof typeof activeTheme.colors;
                  const val = activeTheme.colors[key] as string;
                  return (
                    <label key={k} className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">{key}</span>
                      <input
                        type="color"
                        className="w-9 h-9 rounded border border-[color:var(--border)]"
                        value={val}
                        onChange={(e) => updateTheme(selectedProject.id, activeTheme.themeId, { colors: { [key]: e.target.value } as any })}
                      />
                      <input
                        className="input text-sm w-auto max-w-[10rem]"
                        value={val}
                        onChange={(e) => updateTheme(selectedProject.id, activeTheme.themeId, { colors: { [key]: e.target.value } as any })}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview now replaces canvas above when toggled */}

      {/* Standalone popup window preview (renders current page) */}
      <PreviewPopup open={popupOpen} onClose={closeWebpage} title="PortfoliYOU – Preview" width={pageWidth} height={pageHeight} pageBackground={effectivePageBackground} theme={activeTheme}>
        <div style={{ width: pageWidth, background: effectivePageBackground }}>
          <PagePreview
            width={pageWidth}
            cols={COLS}
            gap={gap}
            rowH={DEFAULT_ROW_H}
            items={items}
            currentPageId={currentPageId || undefined}
            background={effectivePageBackground}
            onNavigatePage={(pid) => {
              if (!selectedProject) return;
              setCurrentPageId(pid);
              try { localStorage.setItem(`py_current_page_${selectedProject.id}`, pid); } catch { /* ignore */ }
            }}
            themeSnapshot={widgetThemeSnapshot}
          />
        </div>
      </PreviewPopup>

      {renameModalOpen && selectedProject && currentPageId && (
        <PageSettingsModal
          title="Page settings"
          initialName={renameOldTitle}
          initialStarter={renameInitialStarter}
          initialBackgroundColor={pageBackground}
          themeBackground={themeBackground}
          onCancel={() => setRenameModalOpen(false)}
          onSave={({ name, starter, backgroundColor }) => {
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
            setPageBackground(selectedProject.id, currentPageId, backgroundColor);
            // Update starter setting
            try { setPageStarter(selectedProject.id, currentPageId, Boolean(starter)); } catch { /* ignore */ }
            try {
              try { localStorage.setItem(`py_current_page_${selectedProject.id}`, currentPageId); } catch { /* ignore */ }
              setCurrentPageId(currentPageId);
              replaceItems(getPageItems(selectedProject.id, currentPageId) as GridItem[]);
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
            if (nextId) replaceItems(getPageItems(selectedProject.id, nextId) as GridItem[]); else replaceItems([]);
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
              const removedTitle = editingItem?.title;
              commitUpdate("Delete widget", (prev) => prev.filter(it => it.id === editingItem!.id ? false : true));
              if (removedTitle) notifyWidgetChange('delete', removedTitle);
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
