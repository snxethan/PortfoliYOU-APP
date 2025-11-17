import React from "react";
import { Eye, Pencil, Grid as GridIcon, MonitorSmartphone, Smartphone, Redo, Undo, Minus, Plus, RefreshCw } from "lucide-react";

export type EditorTopBarProps = {
    selectedProjectName?: string;
    onTitleClick?: () => void;

    previewMode: boolean;
    togglePreviewMode: () => void;

    gap: number;
    setGap: (n: number) => void;

    showGrid: boolean;
    toggleGrid: () => void;

    activeView: 'desktop' | 'mobile';
    setDesktopView: () => void;
    setMobileView: () => void;
    pageWidth: number;
    pageHeight: number;
    heightMode: 'expand' | 'fixed';
    setHeightMode: (m: 'expand' | 'fixed') => void;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;

    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    onOpenWebpage?: () => void;
};

export default function EditorTopBar(props: EditorTopBarProps) {
    const {
        selectedProjectName,
        onTitleClick,
        previewMode,
        togglePreviewMode,
        gap,
        setGap,
        showGrid,
        toggleGrid,
        activeView,
        setDesktopView,
        setMobileView,
        pageWidth,
        pageHeight,
        heightMode,
        setHeightMode,
        canUndo,
        canRedo,
        undo,
        redo,
        onOpenWebpage,
        zoom,
        onZoomIn,
        onZoomOut,
        onResetZoom,
    } = props;

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--muted)]/40">
            <div className="flex items-center gap-3 text-sm min-w-0">
                {/* Edit/Preview toggle */}
                <button className={`btn btn-ghost flex items-center gap-2 text-sm ${previewMode ? 'nav-active' : ''}`} title="Toggle preview (no content editing while in Preview)" onClick={togglePreviewMode}>
                    {previewMode ? <Eye size={16} /> : <Pencil size={16} />}
                    {previewMode ? 'Displaying' : 'Editing'}
                </button>
                {/* Open standalone webpage preview */}
                <button className="btn btn-ghost flex items-center gap-2 text-sm" title="Open webpage (popup)" onClick={onOpenWebpage}>
                    <Eye size={16} />
                    Preview Page
                </button>
                {selectedProjectName && (
                    onTitleClick ? (
                        <button
                            className="btn btn-ghost text-xs max-w-[12rem] truncate"
                            type="button"
                            title="Go back to project overview"
                            onClick={onTitleClick}
                        >
                            {selectedProjectName}
                        </button>
                    ) : (
                        <span className="text-xs text-[color:var(--fg-muted)] truncate max-w-[12rem]" title={selectedProjectName}>
                            {selectedProjectName}
                        </span>
                    )
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Quick settings (disabled in preview mode) */}
                <div className={`flex items-center gap-3 px-2 py-1 rounded border border-[color:var(--border)] bg-transparent ${previewMode ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="hidden sm:flex items-center gap-2 text-xs text-[color:var(--fg-muted)]">
                        <span>Gap</span>
                        <input
                            type="number"
                            className="input w-16"
                            min={0}
                            max={48}
                            step={0.5}
                            value={gap}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                const clamped = isNaN(v) ? 0 : Math.max(0, v);
                                setGap(clamped);
                            }}
                            title="Grid gap (px, decimals allowed)"
                        />
                        <span className="text-[10px]">px</span>
                    </label>

                    {/* Grid toggle */}
                    <button className={`btn btn-ghost flex items-center gap-2 text-sm ${showGrid ? 'nav-active' : ''}`} title="Toggle grid overlay" onClick={toggleGrid}>
                        <GridIcon size={16} />
                        Grid
                    </button>
                    <div className="flex items-center gap-1 ml-2" title="Canvas zoom">
                        <button className="btn btn-ghost btn-xs" onClick={onZoomOut} aria-label="Zoom out">
                            <Minus size={14} />
                        </button>
                        <div className="px-2 py-0.5 text-[11px] font-semibold min-w-[3.5rem] text-center border border-[color:var(--border)] rounded bg-white text-[color:var(--fg)]">
                            {Math.round(zoom * 100)}%
                        </div>
                        <button className="btn btn-ghost btn-xs" onClick={onZoomIn} aria-label="Zoom in">
                            <Plus size={14} />
                        </button>
                        <button className="btn btn-ghost btn-xs" onClick={onResetZoom} title="Reset zoom" aria-label="Reset zoom">
                            <RefreshCw size={12} />
                        </button>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 ml-2" title="Page height behavior">
                        <span className="text-xs text-[color:var(--fg-muted)]">Height</span>
                        <button className={`btn btn-ghost btn-xs ${heightMode === 'expand' ? 'nav-active' : ''}`} onClick={() => setHeightMode('expand')}>Expand</button>
                        <button className={`btn btn-ghost btn-xs ${heightMode === 'fixed' ? 'nav-active' : ''}`} onClick={() => setHeightMode('fixed')}>Scroll</button>
                    </div>
                </div>

                {/* Responsive toggles: desktop or mobile (active in preview too) */}
                <div className="hidden md:flex items-center gap-1 mr-2" title="Viewport size">
                    <button className={`btn btn-ghost btn-xs ${activeView === 'desktop' ? 'nav-active' : ''}`} onClick={setDesktopView} aria-label="Desktop view">
                        <MonitorSmartphone size={14} />
                    </button>
                    <button className={`btn btn-ghost btn-xs ${activeView === 'mobile' ? 'nav-active' : ''}`} onClick={setMobileView} aria-label="Mobile view">
                        <Smartphone size={14} />
                    </button>
                    <span className="ml-1 text-[10px] text-[color:var(--fg-muted)]">{pageWidth} × {pageHeight}px</span>
                </div>

                {/* Undo/Redo group - highlighted box */}
                <div className="flex items-center gap-2 px-2 py-1 rounded border border-[color:var(--border)] bg-transparent">
                    <button className="btn btn-ghost flex items-center gap-2 text-sm disabled:opacity-60" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} data-testid="undo-btn">
                        <Undo size={16} />
                        Undo
                    </button>
                    <button className="btn btn-ghost flex items-center gap-2 text-sm disabled:opacity-60" title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} data-testid="redo-btn">
                        <Redo size={16} />
                        Redo
                    </button>
                </div>
            </div>
        </div>
    );
}
