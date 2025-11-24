import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Theme } from '../../themes/types';
import { applyThemeToElement, FALLBACK_THEME } from '../../themes/utils';

export default function PreviewPopup({
  open,
  title = 'PortfoliYOU – Preview',
  width,
  height,
  pageBackground,
  theme,
  children,
  onClose,
}: {
  open: boolean;
  title?: string;
  width: number;
  height?: number; // optional; popup will be scrollable vertically regardless
  pageBackground?: string;
  theme?: Theme | null;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const winRef = useRef<Window | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  // Compute popup size with a small chrome allowance
  const features = useMemo(() => {
    const w = Math.min(Math.max(360, Math.round(width + 32)), 1800);
    const h = Math.min(Math.max(420, Math.round((height ?? 800) + 128)), 1400);
    return `width=${w},height=${h},resizable=yes,scrollbars=yes`;
  }, [width, height]);

  const syncPopupTheme = (target?: Window | null) => {
    if (!target || target.closed) return;
    const doc = target.document;
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
  };

  useEffect(() => {
    if (!open) {
      // Close if previously opened
      try { winRef.current?.close(); } catch { /* noop */ }
      winRef.current = null;
      setMountNode(null);
      return;
    }
    // Open or reuse existing
    let win = winRef.current;
    if (!win || win.closed) {
      win = window.open('', 'portfoliyou_preview', features) as Window | null;
      if (!win) return;
      winRef.current = win;
    }

    // Write minimal HTML + base styles and scroll behavior
    const doc = win.document;
    doc.open();
    const bg = pageBackground || '#ffffff';
    doc.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { background: ${bg}; color: #111827; font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji"; overflow-x: hidden; overflow-y: auto; }
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
  #__preview_root { min-height: 100%; display: flex; justify-content: center; align-items: flex-start; padding: 16px; box-sizing: border-box; }
</style>
</head><body><div id="__preview_root"></div></body></html>`);
    doc.close();

    // Clone parent styles so Tailwind/Vite CSS applies
    try {
      const head = doc.head;
      const parent = window.document;
      const links = Array.from(parent.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      const styles = Array.from(parent.querySelectorAll('style')) as HTMLStyleElement[];
      for (const l of links) head.appendChild(l.cloneNode(true));
      for (const s of styles) head.appendChild(s.cloneNode(true));
    } catch { /* ignore */ }

    const root = doc.getElementById('__preview_root') as HTMLElement | null;
    setMountNode(root);
    syncPopupTheme(win);

    const onBeforeUnload = () => {
      onClose?.();
      try { winRef.current = null; } catch { /* noop */ }
      setMountNode(null);
    };
    win.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      win.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [open, title, features]);

  useEffect(() => {
    if (!open) return;
    syncPopupTheme(winRef.current);
  }, [open, theme, pageBackground]);

  useEffect(() => {
    return () => {
      try { winRef.current?.close(); } catch { /* noop */ }
      winRef.current = null;
    };
  }, []);

  return mountNode ? createPortal(children, mountNode) : null;
}
