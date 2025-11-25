import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Theme } from '../../themes/types';
import { applyThemeToElement, FALLBACK_THEME } from '../../themes/utils';

export default function PreviewIframe({
    width,
    height,
    className,
    style,
    children,
    pageBackground,
    theme,
}: {
    width: number;
    height: number;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    pageBackground?: string;
    theme?: Theme | null;
}) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
    const [docReady, setDocReady] = useState(false);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const onLoad = () => {
            const doc = iframe.contentDocument;
            if (!doc) return;
            // Minimal blank page styles and CSS variables fallback
            doc.open();
            doc.write(`<!doctype html><html><head><meta charset="utf-8" />
        <style>
                    html, body { height: 100%; overflow-x: hidden; overflow-y: auto; }
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; background: #ffffff; color: #111827; font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji"; }
          :root {
            --bg: #ffffff;
            --surface: #ffffff;
            --muted: #f5f5f5;
            --border: #e5e7eb;
            --fg: #111827;
            --fg-muted: #6b7280;
            --primary: #06b6d4;
            --accent: #06b6d4;
          }
        </style>
      </head><body><div id="__preview_root"></div></body></html>`);
            doc.close();
            // Clone parent document styles into iframe so Tailwind/Vite CSS applies to preview
            try {
                const head = doc.head;
                const parent = window.document;
                const links = Array.from(parent.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
                const styles = Array.from(parent.querySelectorAll('style')) as HTMLStyleElement[];
                for (const l of links) head.appendChild(l.cloneNode(true));
                for (const s of styles) head.appendChild(s.cloneNode(true));
            } catch { /* ignore style cloning issues */ }
            const root = doc.getElementById('__preview_root') as HTMLElement | null;
            setMountNode(root);
            setDocReady(true);
        };
        let cleanup: (() => void) | undefined;
        // If already loaded, trigger immediately
        if (iframe.contentDocument?.readyState === 'complete') {
            onLoad();
        } else {
            iframe.addEventListener('load', onLoad, { once: true });
            cleanup = () => iframe.removeEventListener('load', onLoad);
        }
        return () => {
            cleanup?.();
            setDocReady(false);
        };
    }, []);

    useEffect(() => {
        if (!docReady) return;
        const iframe = iframeRef.current;
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const root = doc.documentElement;
        const body = doc.body;
        const nextTheme = theme || FALLBACK_THEME;
        applyThemeToElement(root, nextTheme);
        applyThemeToElement(body, nextTheme);
        if (pageBackground) {
            body.style.backgroundColor = pageBackground;
            root.style.setProperty('--bg', pageBackground);
        }
    }, [docReady, theme, pageBackground]);

    return (
        <iframe
            ref={iframeRef}
            className={className}
            style={{ display: 'block', ...style }}
            width={width}
            height={height}
            title="Page preview"
        >
            {mountNode ? createPortal(children, mountNode) : null}
        </iframe>
    );
}
