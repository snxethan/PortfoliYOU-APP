import React, { useRef } from "react";

import PreviewIframe from "./PreviewIframe";
import PagePreview from "./PagePreview";
import GridCanvas from "./canvas/GridCanvas";
import type { GridItem } from "./canvas/GridCanvas";

export type ViewportSurfaceProps = {
    pageWidth: number;
    pageHeight: number;
    setPageWidth: (w: number) => void;
    setPageHeight: (h: number) => void;

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
};

export default function ViewportSurface(props: ViewportSurfaceProps) {
    const {
        pageWidth,
        pageHeight,
        setPageWidth,
        setPageHeight,
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
    } = props;

    const scrollRef = useRef<HTMLDivElement | null>(null);

    return (
        <div className="p-4 min-w-0 overflow-x-auto">
            <div
                ref={scrollRef}
                className={"mx-auto min-h-[28rem] border border-black bg-white shadow-sm rounded-md overflow-auto relative py-canvas-static"}
                style={{ width: pageWidth, height: pageHeight }}
            >
                <div className="p-4">
                    {previewMode ? (
                        (() => {
                            const innerWidth = Math.max(0, pageWidth - 32);
                            const height = Math.max(0, pageHeight - 32);
                            return (
                                <PreviewIframe width={innerWidth} height={height}>
                                    <PagePreview width={innerWidth} cols={cols} gap={gap} rowH={rowH} items={items} />
                                </PreviewIframe>
                            );
                        })()
                    ) : (
                        <GridCanvas
                            cols={cols}
                            gap={gap}
                            rowH={rowH}
                            items={items}
                            onChange={onItemsChange}
                            scrollEl={scrollRef.current}
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
                        />
                    )}
                </div>
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
                            const dy = evt.clientY - startY;
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
                            const dx = evt.clientX - startX;
                            const dy = evt.clientY - startY;
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
    );
}
