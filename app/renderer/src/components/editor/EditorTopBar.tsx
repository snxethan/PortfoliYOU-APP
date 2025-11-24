import React from "react";
import { Eye, Pencil, Grid as GridIcon, MonitorSmartphone, Smartphone, Redo, Undo, Minus, Plus, RefreshCw } from "lucide-react";

export type EditorTopBarProps = {
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

    const groupClass = "flex items-center gap-3 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm";
    const groupLabelClass = "text-[11px] uppercase tracking-wide text-[color:var(--fg-muted)]";
    const previewDisabledClass = previewMode ? "opacity-60 pointer-events-none" : "";

    return (
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--muted)]/40">
            <div className="flex flex-wrap items-stretch gap-3">
                <div className={groupClass}>
                    <span className={groupLabelClass}>Mode</span>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm flex items-center gap-2 border border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--fg)]"
                        title="Toggle between editing mode and display preview"
                        onClick={togglePreviewMode}
                        role="switch"
                        aria-checked={previewMode}
                    >
                        {previewMode ? <Eye size={14} /> : <Pencil size={14} />}
                        <span className="text-sm font-semibold tracking-wide">
                            {previewMode ? 'Displaying' : 'Editing'}
                        </span>
                    </button>
                    <button
                        className="btn btn-ghost btn-sm flex items-center gap-2"
                        title="Open webpage (popup)"
                        onClick={onOpenWebpage}
                    >
                        <Eye size={16} />
                        Preview Page
                    </button>
                </div>

                <div className={`${groupClass} flex-wrap ${previewDisabledClass}`}>
                    <span className={groupLabelClass}>Layout</span>
                    <label className="flex items-center gap-1 text-xs text-[color:var(--fg-muted)]" title="Grid gap (px, decimals allowed)">
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
                                const clamped = Number.isNaN(v) ? 0 : Math.max(0, v);
                                setGap(clamped);
                            }}
                        />
                        <span className="text-[10px]">px</span>
                    </label>
                    <button className={`btn btn-ghost btn-xs flex items-center gap-1 ${showGrid ? 'nav-active' : ''}`} title="Toggle grid overlay" onClick={toggleGrid}>
                        <GridIcon size={14} />
                        Grid
                    </button>
                </div>

                <div className={`${groupClass} ${previewDisabledClass}`}>
                    <span className={groupLabelClass}>Canvas</span>
                    <div className="flex items-center gap-1" title="Canvas zoom">
                        <button className="btn btn-ghost btn-xs" onClick={onZoomOut} aria-label="Zoom out">
                            <Minus size={14} />
                        </button>
                        <div className="px-2 py-1 text-[12px] font-semibold tracking-wide min-w-[3.5rem] text-center border border-[color:var(--border-strong,var(--border))] rounded bg-[color:var(--surface)] text-[color:var(--fg-strong,var(--fg))] shadow-inner">
                            {Math.round(zoom * 100)}%
                        </div>
                        <button className="btn btn-ghost btn-xs" onClick={onZoomIn} aria-label="Zoom in">
                            <Plus size={14} />
                        </button>
                        <button className="btn btn-ghost btn-xs" onClick={onResetZoom} title="Reset zoom" aria-label="Reset zoom">
                            <RefreshCw size={12} />
                        </button>
                    </div>
                </div>

                <div className={`${groupClass} flex-wrap ${previewDisabledClass}`}>
                    <span className={groupLabelClass}>Viewport</span>
                    <div className="flex items-center gap-1" title="Viewport size">
                        <button className={`btn btn-ghost btn-xs ${activeView === 'desktop' ? 'nav-active' : ''}`} onClick={setDesktopView} aria-label="Desktop view">
                            <MonitorSmartphone size={14} />
                        </button>
                        <button className={`btn btn-ghost btn-xs ${activeView === 'mobile' ? 'nav-active' : ''}`} onClick={setMobileView} aria-label="Mobile view">
                            <Smartphone size={14} />
                        </button>
                        <span className="text-[11px] text-[color:var(--fg-muted)] whitespace-nowrap">{pageWidth} × {pageHeight}px</span>
                    </div>
                    <div className="flex items-center gap-1 border-l border-[color:var(--border)] pl-2 ml-2" title="Page height behavior">
                        <button className={`btn btn-ghost btn-xs ${heightMode === 'expand' ? 'nav-active' : ''}`} onClick={() => setHeightMode('expand')}>
                            Auto
                        </button>
                        <button className={`btn btn-ghost btn-xs ${heightMode === 'fixed' ? 'nav-active' : ''}`} onClick={() => setHeightMode('fixed')}>
                            Scroll
                        </button>
                    </div>
                </div>

                <div className={`${groupClass} ${previewDisabledClass}`}>
                    <span className={groupLabelClass}>History</span>
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
