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

export default function FrameBar() {
    const [maximized, setMaximized] = useState(false);
    const [dragToTop, setDragToTop] = useState(false);

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
        const unsubMove = window.api?.onWindowEvent?.('window-move-top', (d) => setDragToTop(Boolean(d?.atTop)));
        const unsubState = window.api?.onWindowEvent?.('window-maximize-state', (d) => { if (typeof d?.maximized === 'boolean') { setMaximized(Boolean(d.maximized)); if (d.maximized) setDragToTop(false); } });

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

    return (
        <div className="window-frame">
            <div className="window-frame__left" />
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
