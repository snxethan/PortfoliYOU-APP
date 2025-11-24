import React, { useCallback, useMemo, useRef } from "react";

import type { Theme } from "../../themes/types";
import PreviewIframe from "./PreviewIframe";
import PagePreview from "./PagePreview";
import GridCanvas from "./canvas/GridCanvas";
import type { GridItem } from "./canvas/GridCanvas";
import { themeToCssVars, FALLBACK_THEME } from "../../themes/utils";
type ThemeVarsStyle = React.CSSProperties & Record<string, string>;

export type ViewportSurfaceProps = {
    pageWidth: number;
    pageHeight: number;
    setPageWidth: (w: number) => void;
    setPageHeight: (h: number) => void;
    // Height behavior: 'expand' grows with content; 'fixed' keeps pageHeight and enables internal scroll
    heightMode?: 'expand' | 'fixed';

    previewMode: boolean;

    cols: number;
    rowH: number;
    gap: number;

    items: GridItem[];
    onItemsChange: (next: GridItem[]) => void;

    showGrid: boolean;
    selectedId: string | null;
    onSelect: (id: string | null) => void;

    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onMoveStart?: (it: GridItem) => void;
    onMoveEnd?: (prev: GridItem, next: GridItem) => void;
    onBringToFront?: (id: string) => void;
    onSendToBack?: (id: string) => void;
    onBringForward?: (id: string) => void;
    onSendBackward?: (id: string) => void;
    onTogglePin?: (id: string) => void;
    onOpenModify?: (id: string) => void;
    onDropAsset?: (id: string, hash: string) => void;
    onNavigatePage?: (pageId: string) => void; // used in preview mode
    currentPageId?: string; // for a11y (aria-current) in preview
    zoom: number;
    minZoom: number;
    maxZoom: number;
    onZoomChange: (value: number) => void;
    pageBackground: string;
    theme?: Theme | null;
};

export default function ViewportSurface(props: ViewportSurfaceProps) {
    const {
        pageWidth,
        pageHeight,
        setPageWidth,
        setPageHeight,
        heightMode = 'expand',
        previewMode,
        cols,
        rowH,
        gap,
        items,
        onItemsChange,
        showGrid,
        selectedId,
        onSelect,
        onDelete,
        onDuplicate,
        onMoveStart,
        onMoveEnd,
        onBringToFront,
        onSendToBack,
        onBringForward,
        onSendBackward,
        onTogglePin,
        onOpenModify,
        onDropAsset,
        onNavigatePage,
        currentPageId,
        zoom,
        minZoom,
        maxZoom,
        onZoomChange,
        pageBackground,
        theme,
    } = props;

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const pageThemeVars = useMemo<ThemeVarsStyle>(() => {
        const vars = themeToCssVars(theme || FALLBACK_THEME);
        const style = {} as ThemeVarsStyle;
        for (const [key, value] of Object.entries(vars)) {
            style[key] = value;
        }
        return style;
    }, [theme]);

    // Compute preview content height (same math as PagePreview) to allow expand mode to grow beyond pageHeight
    const previewContentRows = useMemo(() => {
        if (!items || items.length === 0) return 12;
        return Math.max(12, ...items.map(it => it.y + it.h));
    }, [items]);
    const previewRowH = useMemo(() => {
        if (cols <= 0) return rowH;
        const inner = Math.max(0, pageWidth - gap * (cols - 1));
        const cw = Math.floor(inner / cols);
        return cw > 0 ? cw : rowH;
    }, [pageWidth, cols, gap, rowH]);
    const previewContentHeight = useMemo(() => {
        const r = Math.max(1, previewContentRows);
        return r * previewRowH + (r - 1) * gap;
    }, [previewContentRows, previewRowH, gap]);
    const effectivePageHeight = heightMode === 'expand' ? Math.max(pageHeight, previewMode ? previewContentHeight : pageHeight) : pageHeight;
    const baseMinHeight = 28 * 16; // match min-h-[28rem]
    const logicalHeight = Math.max(baseMinHeight, effectivePageHeight);
    const clampZoomValue = useCallback((value: number) => Math.min(maxZoom, Math.max(minZoom, value)), [minZoom, maxZoom]);
    const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.shiftKey) return; // let Ctrl+Shift+wheel control global zoom
        event.preventDefault();
        const next = zoom * (1 - event.deltaY * 0.0015);
        onZoomChange(clampZoomValue(next));
    }, [zoom, onZoomChange, clampZoomValue]);
    const scaledWidth = pageWidth * zoom;
    const scaledHeight = logicalHeight * zoom;
    const canvasBackground = pageBackground || '#ffffff';

    return (
        <div ref={scrollRef} className="p-2 min-w-0 overflow-auto" onWheel={handleWheel}>
            <div className="flex justify-center">
                <div
                    className={"min-h-[28rem] border border-[color:var(--border)] shadow-sm rounded-md relative " + (heightMode === 'fixed' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-visible')}
                    style={{ width: scaledWidth, minHeight: scaledHeight, backgroundColor: canvasBackground }}
                    data-testid="viewport-surface"
                    data-mode={previewMode ? 'preview' : 'edit'}
                >
                    {previewMode ? (
                        <div style={{ width: scaledWidth, minHeight: scaledHeight }}>
                            <PreviewIframe
                                width={pageWidth}
                                height={effectivePageHeight}
                                pageBackground={canvasBackground}
                                theme={theme}
                                style={{
                                    width: pageWidth,
                                    height: effectivePageHeight,
                                    transform: `scale(${zoom})`,
                                    transformOrigin: 'top left',
                                    display: 'block',
                                }}
                            >
                                <PagePreview
                                    width={pageWidth}
                                    cols={cols}
                                    gap={gap}
                                    rowH={rowH}
                                    items={items}
                                    currentPageId={currentPageId}
                                    background={canvasBackground}
                                    onNavigatePage={onNavigatePage}
                                />
                            </PreviewIframe>
                        </div>
                    ) : (
                        <div style={pageThemeVars}>
                            <GridCanvas
                                pageWidth={pageWidth}
                                zoom={zoom}
                                cols={cols}
                                gap={gap}
                                rowH={rowH}
                                items={items}
                                onChange={onItemsChange}
                                scrollEl={scrollRef.current}
                                viewportHeight={pageHeight}
                                showGrid={showGrid}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onDuplicate={onDuplicate}
                                onItemMoveStart={onMoveStart}
                                onItemMoveEnd={onMoveEnd}
                                onBringToFront={onBringToFront}
                                onSendToBack={onSendToBack}
                                onBringForward={onBringForward}
                                onSendBackward={onSendBackward}
                                onTogglePin={onTogglePin}
                                onOpenModify={onOpenModify}
                                onDropAsset={onDropAsset}
                            />
                        </div>
                    )}
                    {/* Resize handles */}
                    {/* Bottom-center: vertical resize */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 bottom-1 h-3 w-8 cursor-ns-resize flex items-center justify-center text-[color:var(--fg-muted)] z-10 select-none"
                        title="Resize page height"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            const startY = e.clientY;
                            const startH = pageHeight;
                            const el = e.currentTarget as HTMLDivElement;
                            el.setPointerCapture(e.pointerId);
                            const onMove = (evt: PointerEvent) => {
                                const dy = (evt.clientY - startY) / zoom;
                                const next = Math.min(4000, Math.max(320, Math.round(startH + dy)));
                                setPageHeight(next);
                                try { localStorage.setItem('py_editor_page_h', String(next)); } catch { /* ignore */ }
                            };
                            const onUp = () => {
                                try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
                                window.removeEventListener('pointermove', onMove, true);
                                window.removeEventListener('pointerup', onUp, true);
                            };
                            window.addEventListener('pointermove', onMove, true);
                            window.addEventListener('pointerup', onUp, true);
                        }}
                    >
                        <div className="w-6 h-1 bg-[color:var(--border)] rounded shadow-sm" />
                    </div>
                    {/* Bottom-right: diagonal resize (width & height) */}
                    <div
                        className="absolute right-1 bottom-1 h-4 w-4 cursor-nwse-resize flex items-center justify-center text-[color:var(--fg-muted)] z-10 select-none"
                        title="Resize page width & height"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = pageWidth;
                            const startH = pageHeight;
                            const el = e.currentTarget as HTMLDivElement;
                            el.setPointerCapture(e.pointerId);
                            const onMove = (evt: PointerEvent) => {
                                const dx = (evt.clientX - startX) / zoom;
                                const dy = (evt.clientY - startY) / zoom;
                                const nextW = Math.min(1600, Math.max(320, Math.round(startW + dx)));
                                const nextH = Math.min(4000, Math.max(320, Math.round(startH + dy)));
                                setPageWidth(nextW);
                                setPageHeight(nextH);
                                try { localStorage.setItem('py_editor_page_w', String(nextW)); } catch { /* ignore */ }
                                try { localStorage.setItem('py_editor_page_h', String(nextH)); } catch { /* ignore */ }
                            };
                            const onUp = () => {
                                try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
                                window.removeEventListener('pointermove', onMove, true);
                                window.removeEventListener('pointerup', onUp, true);
                            };
                            window.addEventListener('pointermove', onMove, true);
                            window.addEventListener('pointerup', onUp, true);
                        }}
                    >
                        <div className="w-full h-full border-r-2 border-b-2 border-[color:var(--border)] rounded-br bg-white/30" />
                    </div>
                </div>
            </div>
        </div>
    );
}
