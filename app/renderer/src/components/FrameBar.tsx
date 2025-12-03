import React, { useEffect, useState } from 'react';

// Inline SVG icons to avoid icon name mismatches
function IconMin() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
    );
}
function IconMax() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
    );
}
function IconRestore() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v11a2 2 0 0 0 2 2h11" /><rect x="7" y="3" width="13" height="13" rx="2" ry="2" /></svg>
    );
}
function IconClose() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    );
}

function IconFullscreen() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
    );
}

function IconDevtools() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1 1 0 0 1 .2 1.1l-1.2 2.1a1 1 0 0 1-1.2.5l-2.2-.7a6 6 0 0 1-2.6 1.5l-.3 2.3a1 1 0 0 1-1 .9h-2.4a1 1 0 0 1-1-.9l-.3-2.3a6 6 0 0 1-2.6-1.5l-2.2.7a1 1 0 0 1-1.2-.5L4.4 16a1 1 0 0 1 .2-1.1l1.9-1.5a6.2 6.2 0 0 1 0-2.8L4.6 9a1 1 0 0 1-.2-1.1l1.2-2.1a1 1 0 0 1 1.2-.5l2.2.7a6 6 0 0 1 2.6-1.5l.3-2.3a1 1 0 0 1 1-.9h2.4a1 1 0 0 1 1 .9l.3 2.3a6 6 0 0 1 2.6 1.5l2.2-.7a1 1 0 0 1 1.2.5L19.6 8a1 1 0 0 1-.2 1.1L17.5 10.6a6.2 6.2 0 0 1 0 2.8Z" />
        </svg>
    );
}

function IconZoomIn() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
    );
}

function IconZoomOut() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
    );
}

export default function FrameBar() {
    const [maximized, setMaximized] = useState(false);
    const [dragToTop, setDragToTop] = useState(false);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        // query initial state
        (async () => {
            try {
                const r = await window.api?.windowIsMaximized?.();
                setMaximized(Boolean(r?.maximized));
            } catch { /* ignore */ }
        })();

        // subscribe to main window events
        const unsubMax = window.api?.onWindowEvent?.('window-maximize', () => { setMaximized(true); setDragToTop(false); });
        const unsubUnmax = window.api?.onWindowEvent?.('window-unmaximize', () => { setMaximized(false); setDragToTop(false); });
        const unsubMove = window.api?.onWindowEvent?.('window-move-top', (d: { atTop?: boolean }) => setDragToTop(Boolean(d?.atTop)));
        const unsubState = window.api?.onWindowEvent?.('window-maximize-state', (d: { maximized?: boolean }) => { if (typeof d?.maximized === 'boolean') { setMaximized(Boolean(d.maximized)); if (d.maximized) setDragToTop(false); } });

        return () => {
            try { unsubMax?.(); } catch { /* ignore */ }
            try { unsubUnmax?.(); } catch { /* ignore */ }
            try { unsubMove?.(); } catch { /* ignore */ }
            try { unsubState?.(); } catch { /* ignore */ }
        };
    }, []);

    async function onMinimize() {
        try { await window.api?.windowMinimize?.(); } catch { /* ignore */ }
    }
    async function onToggleMax() {
        try {
            const r = await window.api?.windowToggleMaximize?.();
            if (r && typeof r.maximized === 'boolean') setMaximized(r.maximized);
        } catch { /* ignore */ }
    }
    async function onClose() {
        try { await window.api?.windowClose?.(); } catch { /* ignore */ }
    }
    async function onToggleDevtools() {
        try { await window.api?.toggleDevTools?.(); } catch { /* ignore */ }
    }

    function handleZoomIn() {
        setZoom(prev => Math.min(prev + 0.1, 2));
        document.body.style.zoom = String(Math.min(zoom + 0.1, 2));
    }

    function handleZoomOut() {
        setZoom(prev => Math.max(prev - 0.1, 0.5));
        document.body.style.zoom = String(Math.max(zoom - 0.1, 0.5));
    }

    return (
        <div className="window-frame">
            <div className="window-frame__left flex items-center pl-1 gap-1" style={{ pointerEvents: 'auto' }}>
                <button
                    type="button"
                    className="window-control"
                    title="Toggle DevTools"
                    onClick={onToggleDevtools}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label="Toggle DevTools"
                >
                    <IconDevtools />
                </button>
                <div className="flex items-center gap-0.5 ml-1">
                    <button
                        type="button"
                        className="window-control"
                        title="Zoom Out"
                        onClick={handleZoomOut}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Zoom Out"
                        disabled={zoom <= 0.5}
                    >
                        <IconZoomOut />
                    </button>
                    <span className="text-[10px] text-[color:var(--fg-muted)] px-1 min-w-[32px] text-center select-none">{Math.round(zoom * 100)}%</span>
                    <button
                        type="button"
                        className="window-control"
                        title="Zoom In"
                        onClick={handleZoomIn}
                        onMouseDown={(e) => e.stopPropagation()}
                        aria-label="Zoom In"
                        disabled={zoom >= 2}
                    >
                        <IconZoomIn />
                    </button>
                </div>
            </div>
            <div className="window-frame__center flex items-center justify-center gap-2" aria-hidden={false}>
                <div className="relative flex items-center gap-2">
                    <img
                        src="/icon.png"
                        alt="Portfoli-YOU icon"
                        className="w-5 h-5 rounded-sm object-cover"
                        onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement;
                            if (!t.dataset.fallback) { t.dataset.fallback = '1'; t.src = '/icon.svg'; }
                        }}
                    />
                    <div className="text-[color:var(--fg-muted)] text-sm font-semibold">Portfoli-YOU</div>
                </div>
            </div>
            <div className="window-frame__controls">
                <button className="window-control" title="Minimize" onClick={onMinimize} aria-label="Minimize window">
                    <IconMin />
                </button>
                <button className="window-control" title={maximized ? 'Restore' : 'Maximize'} onClick={onToggleMax} aria-label={maximized ? 'Restore window' : 'Maximize window'}>
                    {dragToTop ? <IconFullscreen /> : (maximized ? <IconRestore /> : <IconMax />)}
                </button>
                <button className="window-control window-control--close" title="Close Application" onClick={onClose} aria-label="Close Application">
                    <IconClose />
                </button>
            </div>
        </div>
    );
}
