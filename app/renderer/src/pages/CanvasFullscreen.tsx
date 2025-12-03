import React, { useEffect, useRef, Suspense, useMemo, useState, useCallback } from "react";
import { X, ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight, ChevronUp, ChevronsDown, ChevronsUp, GripVertical } from "lucide-react";
import { DndContext, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, rectIntersection, DragOverlay, type Modifier } from "@dnd-kit/core";

import EditorSettings from "../components/editor/EditorSettings";
import PageSettings from "../components/editor/PageSettings";
import DragOverlayPreview from "../components/editor/DragOverlayPreview";
import ViewportSurface from "../components/editor/ViewportSurface";
import { WidgetsPalette } from "../components/editor/widgets/WidgetsPalette";
import AssetsPanel from "../components/editor/widgets/AssetsPanel";
import type { GridItem } from "../components/editor/canvas/GridCanvas";
import type { Theme } from "../themes/types";
import type { WidgetThemeSnapshot } from "../widgets/theme";

const COLS = 12;
const DEFAULT_ROW_H = 32;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.75;

export type CanvasFullscreenProps = {
    // Canvas state
    pageWidth: number;
    pageHeight: number;
    setPageWidth: (w: number) => void;
    setPageHeight: (h: number) => void;
    heightMode: 'expand' | 'fixed';
    setHeightMode: (m: 'expand' | 'fixed') => void;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    applyZoom: (value: number) => void;
    gap: number;
    setGap: (n: number) => void;
    showGrid: boolean;
    toggleGrid: () => void;
    items: GridItem[];
    replaceItems: (items: GridItem[]) => void;
    selectedIds: string[];
    handleSelect: (id: string | null, opts?: any) => void;
    handleMarqueeSelect: (ids: string[], opts?: any) => void;
    commitUpdate: (label: string, makeNext: (prev: GridItem[]) => GridItem[]) => void;
    notifyWidgetChange: (action: 'create' | 'delete', label?: string) => void;
    normalizeZ: (items: GridItem[]) => GridItem[];
    handleItemMoveStart: (it: GridItem) => void;
    handleItemMoveEnd: (prev: GridItem, next: GridItem) => void;
    bringToFront: (id: string) => void;
    sendToBack: (id: string) => void;
    bringForward: (id: string) => void;
    sendBackward: (id: string) => void;
    togglePin: (id: string) => void;
    openModify: (id: string) => void;

    // Editor settings
    previewMode: boolean;
    togglePreviewMode: () => void;
    activeView: 'desktop' | 'mobile';
    setDesktopView: () => void;
    setMobileView: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    onOpenWebpage?: () => void;

    // Page settings
    selectedProject: any;
    currentPageId: string | null;
    setCurrentPageId: (id: string | null) => void;
    createPage: () => void;
    duplicatePage: () => void;
    renamePage: (name: string) => void;
    deletePage: (projectId: string, pageId: string) => void;
    openSettings: () => void;
    pageBackground: string | null;
    themeBackground: string;
    setPageBackground: (projectId: string, pageId: string, color: string | null) => void;

    // Theme
    activeTheme: Theme | null;
    widgetThemeSnapshot: WidgetThemeSnapshot | null;
    effectivePageBackground: string;

    // Refs
    canvasWrapperRef: React.RefObject<HTMLDivElement>;
    beginResizePalette: (e: React.PointerEvent | PointerEvent) => void;

    // Dashboard state
    paletteCollapsed: boolean;
    togglePalette: () => void;
    paletteWidth: number;
    paletteRef: React.RefObject<HTMLDivElement | null>;
    widgetsOpen: boolean;
    toggleWidgetsOpen: () => void;
    assetsOpen: boolean;
    toggleAssetsOpen: () => void;

    // DnD state
    activeDrag: { src?: string; type?: string; label?: string; w?: number; h?: number; schemaVersion?: number } | undefined;
    setActiveDrag: (drag: { src?: string; type?: string; label?: string; w?: number; h?: number; schemaVersion?: number } | undefined) => void;
    dragPointerStart: React.MutableRefObject<{ x: number; y: number } | null>;
    dragPointerLast: React.MutableRefObject<{ x: number; y: number } | null>;
    dragOverlaySize: React.MutableRefObject<{ width: number; height: number } | null>;
    dragPointerOffset: React.MutableRefObject<{ x: number; y: number } | null>;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;

    // Exit handler
    onExit: () => void;
};

export default function CanvasFullscreen(props: CanvasFullscreenProps) {
    const {
        pageWidth,
        pageHeight,
        setPageWidth,
        setPageHeight,
        heightMode,
        setHeightMode,
        zoom,
        onZoomIn,
        onZoomOut,
        onResetZoom,
        applyZoom,
        gap,
        setGap,
        showGrid,
        toggleGrid,
        items,
        replaceItems,
        selectedIds,
        handleSelect,
        handleMarqueeSelect,
        commitUpdate,
        notifyWidgetChange,
        normalizeZ,
        handleItemMoveStart,
        handleItemMoveEnd,
        bringToFront,
        sendToBack,
        bringForward,
        sendBackward,
        togglePin,
        openModify,
        previewMode,
        togglePreviewMode,
        activeView,
        setDesktopView,
        setMobileView,
        canUndo,
        canRedo,
        undo,
        redo,
        onOpenWebpage,
        selectedProject,
        currentPageId,
        setCurrentPageId,
        createPage,
        duplicatePage,
        renamePage,
        deletePage,
        openSettings,
        pageBackground,
        themeBackground,
        setPageBackground,
        activeTheme,
        widgetThemeSnapshot,
        effectivePageBackground,
        canvasWrapperRef,
        beginResizePalette,
        paletteCollapsed,
        togglePalette,
        paletteWidth,
        paletteRef,
        widgetsOpen,
        toggleWidgetsOpen,
        assetsOpen,
        toggleAssetsOpen,
        activeDrag,
        setActiveDrag,
        dragPointerStart,
        dragPointerLast,
        dragOverlaySize,
        dragPointerOffset,
        onKeyDown,
        onExit,
    } = props;

    // Drag overlay cursor alignment
    const dragOverlayCursorAlign = useMemo<Modifier>(() => (({ transform, activeNodeRect }) => {
        if (!activeNodeRect) return transform;
        const pointer = dragPointerLast.current || dragPointerStart.current;
        if (!pointer) return transform;
        const overlaySize = dragOverlaySize.current;
        if (!overlaySize) return transform;
        const offset = dragPointerOffset.current;
        const offsetX = offset ? offset.x : overlaySize.width / 2;
        const offsetY = offset ? offset.y : overlaySize.height / 2;
        return { ...transform, x: pointer.x - activeNodeRect.left - offsetX, y: pointer.y - activeNodeRect.top - offsetY };
    }), [dragPointerStart, dragPointerLast, dragOverlaySize, dragPointerOffset]);

    // Lock body scroll when mounted
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Collapsible header state
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

    // Compute palette panel style
    const palettePanelStyle: React.CSSProperties = paletteCollapsed
        ? { width: 32, minWidth: 32, maxWidth: 32 }
        : { width: paletteWidth, minWidth: 260, maxWidth: 520 };

    return (
        <div className="fixed flex flex-col bg-[color:var(--bg)] overflow-auto" style={{ top: 'var(--frame-bar-h, 36px)', left: 0, right: 0, bottom: 0, zIndex: 9999, animation: 'py-pop 0.3s ease-out' }}>
            {/* Header: Editor and Page Settings */}
            <div
                className={`w-full flex flex-col bg-[color:var(--muted)] border-b border-[color:var(--border)]/30 shadow-lg flex-shrink-0 relative transition-all duration-300 ease-in-out ${headerCollapsed ? 'cursor-pointer' : ''}`}
                style={{ boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.3)' }}
                onClick={(e) => {
                    if (headerCollapsed && !(e.target as HTMLElement).closest('button[title="Exit Fullscreen"]')) {
                        setHeaderCollapsed(false);
                    }
                }}
            >
                {/* Top Bar with Portfolio Name and Exit Button */}
                <div className="w-full flex items-center justify-between px-4 py-2 bg-[color:var(--surface)]/30 border-b border-[color:var(--border)]/30">
                    {headerCollapsed ? (
                        <div className="flex items-center gap-1 flex-shrink-0 text-[color:var(--fg-muted)]">
                            <ChevronsDown size={14} />
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs flex items-center gap-1 flex-shrink-0"
                            title="Collapse Settings"
                            onClick={(e) => {
                                e.stopPropagation();
                                setHeaderCollapsed(true);
                            }}
                        >
                            <ChevronsUp size={14} />
                        </button>
                    )}
                    <div className="flex-1 flex items-center justify-center">
                        <p className="section-title mb-0">
                            {selectedProject?.name || 'Portfolio'} · Canvas
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost flex items-center gap-2 flex-shrink-0"
                        title="Exit Fullscreen"
                        onClick={onExit}
                    >
                        <X size={16} />
                        <span className="text-sm font-medium">Exit Fullscreen</span>
                    </button>
                </div>

                {/* Collapsible Settings Sections */}
                {!headerCollapsed && (
                    <>
                        {/* Editor Settings Section */}
                        <div className="w-full flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]/50">
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)] font-semibold">Editor Settings</p>
                            </div>
                            <div className="flex-1 flex items-center justify-end gap-2 overflow-x-auto ml-4" style={{ minWidth: 0 }}>
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
                                    setHeightMode={setHeightMode}
                                    canUndo={canUndo}
                                    canRedo={canRedo}
                                    undo={undo}
                                    redo={redo}
                                    zoom={zoom}
                                    onZoomIn={onZoomIn}
                                    onZoomOut={onZoomOut}
                                    onResetZoom={onResetZoom}
                                    onOpenWebpage={onOpenWebpage}
                                />
                            </div>
                        </div>

                        {/* Page Settings Section */}
                        <div className="w-full flex items-center justify-between px-6 py-4 border-b border-[color:var(--accent)]/20">
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)] font-semibold">Page Settings</p>
                            </div>
                            <div className="flex-1 flex items-center justify-end gap-2 overflow-x-auto ml-4" style={{ minWidth: 0 }}>
                                <PageSettings
                                    isCloud={!!selectedProject?._cloudId}
                                    pageOrder={selectedProject?.pageOrder || []}
                                    pages={selectedProject?.pages || {}}
                                    currentPageId={currentPageId}
                                    onSelectPage={setCurrentPageId}
                                    onCreatePage={createPage}
                                    onDuplicatePage={duplicatePage}
                                    onRenameInline={renamePage}
                                    onDeleteCurrentPage={() => {
                                        if (selectedProject && currentPageId) {
                                            deletePage(selectedProject.id, currentPageId);
                                        }
                                    }}
                                    onOpenSettings={openSettings}
                                    pageBackground={pageBackground}
                                    themeBackground={themeBackground}
                                    onQuickBackgroundChange={(color) => {
                                        if (selectedProject && currentPageId) {
                                            setPageBackground(selectedProject.id, currentPageId, color);
                                        }
                                    }}
                                    onOpenThemeSettings={() => {/* implement if needed */ }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Padding between header and canvas */}
            <div className="w-full h-3 bg-[color:var(--bg)] border-b border-[color:var(--border)]/20 flex-shrink-0" />

            {/* Main body: DndContext wrapping grid layout */}
            <DndContext
                sensors={useSensors(
                    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
                    useSensor(MouseSensor),
                    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
                )}
                collisionDetection={rectIntersection}
                onDragStart={(event: DragStartEvent) => {
                    const data = event.active.data.current as { src?: string; type?: string; label?: string; w?: number; h?: number; schemaVersion?: number } | undefined;
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

                        const effectiveZoom = zoom || 1;
                        const colW = Math.floor(pageWidth / COLS);
                        const baseUnit = Math.max(1, colW + gap);
                        const baseX = baseUnit;
                        const baseY = baseUnit;
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
                            const maxZ = norm.length;
                            return [...norm, { ...newItem, z: maxZ }];
                        });
                        notifyWidgetChange('create', newItem.title);
                    }
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
                <DragOverlay dropAnimation={null} modifiers={[dragOverlayCursorAlign]}>
                    <DragOverlayPreview activeDrag={activeDrag} onMeasure={(size) => { dragOverlaySize.current = size; }} />
                </DragOverlay>
                <div
                    className="w-full grid gap-0"
                    style={{
                        gridTemplateColumns: paletteCollapsed ? 'minmax(0,1fr) 32px' : `minmax(0,1fr) ${Math.round(paletteWidth)}px`,
                        minHeight: '100%',
                    }}
                    onKeyDown={onKeyDown}
                    tabIndex={0}
                >
                    {/* Canvas Pane */}
                    <div className="min-w-0 bg-[color:var(--bg)]" style={{ position: 'relative' }}>
                        <div
                            style={{ position: 'relative', minHeight: '100%' }}
                            ref={canvasWrapperRef}
                            onPointerDown={(e) => {
                                try {
                                    const el = canvasWrapperRef.current;
                                    if (!el) return;
                                    const rect = el.getBoundingClientRect();
                                    const distFromRight = rect.right - e.clientX;
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
                                        const maxZ = norm.length;
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
                    </div>

                    {/* Dashboard Sidebar - exactly like Editor.tsx */}
                    <aside
                        className={`relative surface p-4 border border-[color:var(--border)] rounded-2xl shadow-lg bg-[color:var(--surface)]/80 overflow-hidden ${previewMode ? 'opacity-50 pointer-events-none' : ''} flex flex-col palette-full-height`}
                        style={palettePanelStyle}
                        onPointerDown={(e) => {
                            const el = paletteRef.current || (e.currentTarget as HTMLElement);
                            const rect = el ? (el.getBoundingClientRect ? el.getBoundingClientRect() : null) : null;
                            if (!rect) return;
                            const localX = e.clientX - rect.left;
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
                                    onPointerDown={(e) => beginResizePalette(e as unknown as PointerEvent)}
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
                                        const el = paletteRef.current || (e.currentTarget && (e.currentTarget as HTMLElement).closest('.palette-full-height') as HTMLElement | null);
                                        const rect = el ? el.getBoundingClientRect() : null;
                                        if (!rect) return;
                                        const localX = e.clientX - rect.left;
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
    );
}