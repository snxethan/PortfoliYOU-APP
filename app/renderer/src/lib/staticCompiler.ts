import path from 'path';

import fs from 'fs-extra';
// import React from 'react';
import ReactDOMServer from 'react-dom/server';

import type { LocalProject, Widget, Page, PortfolioMeta } from '../providers/ProjectsProvider';
import { themeToCssVars, FALLBACK_THEME } from '../themes/utils';
import { WidgetsRegistry } from '../widgets/registry';

const DEFAULT_PLACEHOLDER = '/assets/placeholder.png';

export async function compileStaticSite(
    project: LocalProject,
    assets: Record<string, Buffer | Blob>,
    outputDir: string
): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    await fs.ensureDir(path.join(outputDir, 'assets'));

    // 1. Copy assets
    for (const [hash, file] of Object.entries(assets)) {
        const outPath = path.join(outputDir, 'assets', hash);
        await fs.writeFile(outPath, Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer()));
    }
    // Add default placeholder if missing
    const placeholderPath = path.join(outputDir, DEFAULT_PLACEHOLDER);
    if (!await fs.pathExists(placeholderPath)) {
        // You may want to use a local placeholder asset or generate one
        await fs.writeFile(placeholderPath, Buffer.alloc(0)); // Empty file for now
    }

    // 2. Generate HTML for each page and collect per-widget CSS (if widgets expose it)
    const pageOutputs: Array<{ filename: string; html: string }> = [];
    const collectedCss: string[] = [];

    async function renderWidgetToHtml(widget: Widget): Promise<string> {
        // Resolve widget definition so we can ask for static CSS
        let def: any = undefined;
        try {
            def = await WidgetsRegistry.ensure(widget.type);
        } catch {
            // ignore loader failures and fallback to registry.get
            def = WidgetsRegistry.get(widget.type);
        }

        // Normalize props and asset paths
        let props: any = {};
        if (typeof widget.props === 'object' && widget.props !== null) props = { ...widget.props };
        if (typeof props.src === 'string' && props.src.startsWith('asset://')) {
            const hash = props.src.slice('asset://'.length);
            props.src = `/assets/${hash}`;
        }

        // Ask widget for static CSS if it exposes getStaticCss
        try {
            if (def && typeof def.getStaticCss === 'function') {
                const raw = await def.getStaticCss(props, widget.widgetId || widget.id || String(Math.random()).slice(2));
                if (raw && typeof raw === 'string') {
                    const trimmed = raw.trim();
                    if (trimmed.length > 0) {
                        // If the returned CSS looks like a full stylesheet (contains a selector block), include as-is.
                        // Otherwise treat it as declarations and scope them to the instance selector.
                        if (/[{}]/.test(trimmed)) {
                            collectedCss.push(trimmed);
                        } else {
                            const sel = `.widget-instance-${widget.widgetId || widget.id}`;
                            collectedCss.push(`${sel} { ${trimmed} }`);
                        }
                    }
                }
            }
        } catch {
            // ignore CSS generation errors
        }

        // Render widget markup (use provided render function if available)
        if (def && typeof def.render === 'function') {
            try {
                const el = def.render(props);
                const inner = ReactDOMServer.renderToStaticMarkup(el as any);
                // Wrap each widget with an instance-scoped class so per-instance CSS can target it
                return `<div class="widget widget-instance-${widget.widgetId || widget.id}">${inner}</div>`;
            } catch {
                return `<div class="widget widget-instance-${widget.widgetId || widget.id}">[render error: ${String(e)}]</div>`;
            }
        }

        // Fallback: basic JSON dump
        return `<div class="widget widget-instance-${widget.widgetId || widget.id}"><pre>${escapeHtml(JSON.stringify(widget.props || {}, null, 2))}</pre></div>`;
    }

    for (const pageId of project.pageOrder) {
        const page = project.pages[pageId];
        if (!page) continue;
        const widgets = (page.widgets || []).map(wid => project.widgets[wid]).filter(Boolean);
        const widgetHtmls = await Promise.all(widgets.map(w => renderWidgetToHtml(w)));

        // Mirror the editor's canvas defaults so the compiled page layout
        // matches the editor preview (absolute-positioned widget wrappers).
        const COLS = 12;
        const GAP = 12; // px
        const ROW_H = 32; // px
        const CONTAINER_MAX_WIDTH = 1100; // matches editor/container
        const CONTAINER_PADDING = 36; // left+right padding used in .container
        const innerWidth = Math.max(0, CONTAINER_MAX_WIDTH - (CONTAINER_PADDING * 2));
        const colW = COLS > 0 ? Math.floor((innerWidth - GAP * (COLS - 1)) / COLS) : 0;

        // Compute content rows to determine canvas height
        const contentRows = widgets.length === 0 ? 12 : Math.max(12, ...widgets.map((w: any) => {
            const layout = (w?.layout ?? {}) as any;
            return (typeof layout.y === 'number' ? layout.y : 0) + (typeof layout.h === 'number' ? layout.h : 1);
        }));
        const height = contentRows * ROW_H + (contentRows - 1) * GAP;

        const widgetBodies = widgets.map((w: any, index: number) => {
            const layout = (w?.layout ?? {}) as any;
            const lx = typeof layout.x === 'number' ? layout.x : 0;
            const ly = typeof layout.y === 'number' ? layout.y : 0;
            const lw = typeof layout.w === 'number' ? layout.w : 1;
            const lh = typeof layout.h === 'number' ? layout.h : 1;
            const lz = typeof layout.z === 'number' ? layout.z : index;

            const left = lx * (colW + GAP);
            const top = ly * (ROW_H + GAP);
            const wPx = lw * colW + (lw - 1) * GAP;
            const hPx = lh * ROW_H + (lh - 1) * GAP;
            const z = 100 + (typeof lz === 'number' ? lz : index);

            const inner = widgetHtmls[index] || '';
            return `<div class="page-widget-wrapper" style="position:absolute;left:${left}px;top:${top}px;width:${wPx}px;height:${hPx}px;z-index:${z};">${inner}</div>`;
        }).join('\n');

        const html = renderPageHtml(page, widgetBodies, project, innerWidth, height);
        pageOutputs.push({ filename: `${pageId}.html`, html });
    }

    // 3. Write aggregated CSS (base + widget-specific)
    // Add a small set of page/grid rules so exported widgets mirror the editor's
    // behavior: each widget will be treated as a contained block and clipped to
    // avoid children rendering outside their section (matches editor preview).
    const baseCss = `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Inter, sans-serif; color: var(--fg, #0f172a); }
.container { max-width: 1100px; margin: 0 auto; padding: 36px; }
.page-canvas { position: relative; margin: 0 auto; }
.page-widget-wrapper { position: absolute; will-change: transform; }
.widget { width: 100%; height: 100%; display: block; }
.widget img,
.widget video { max-width: 100%; max-height: 100%; display: block; }
.widget-unknown,
.widget-error { font-family: monospace; background: transparent; border: 1px dashed var(--border, #d1d5db); padding: 12px; border-radius: 6px; white-space: pre-wrap; }
`;
    const fullCss = [baseCss, ...collectedCss].join('\n\n');
    // Also emit theme variables and global styles so static output matches preview
    // Build theme CSS from project active theme when available
    let themeCss = '';
    try {
        const activeTheme = (project && (project as any).themes && (project as any).themes[(project as any).activeThemeId]) || null;
        const vars = themeToCssVars(activeTheme || FALLBACK_THEME as any);
        const rootLines = Object.entries(vars).map(([k, v]) => `${k}: ${v};`);
        themeCss = `:root {\n${rootLines.join('\n')}\n}\n`;
        themeCss += `body { color: var(--fg); background: var(--bg); font-family: var(--body-font); }\n`;
    } catch {
        // fallback: minimal vars
        themeCss = `:root { --bg: #ffffff; --fg: #111827; --accent: #06b6d4; }\n`;
    }

    // Try to collect global styles (Tailwind/Vite CSS and any injected <style> tags) from parent document
    let tailwindCss = '';
    try {
        if (typeof document !== 'undefined') {
            const parent = window.document;
            // Inline <style> contents
            const styles = Array.from(parent.querySelectorAll('style')) as HTMLStyleElement[];
            for (const s of styles) {
                if (s.innerText && s.innerText.trim()) tailwindCss += s.innerText + '\n\n';
            }
            // Fetch linked stylesheets
            const links = Array.from(parent.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
            for (const l of links) {
                try {
                    const href = l.href;
                    if (!href) continue;
                    // attempt to fetch the stylesheet content

                    const res = await fetch(href, { cache: 'no-store' });
                    if (res.ok) {

                        const txt = await res.text();
                        tailwindCss += `/* source: ${href} */\n` + txt + '\n\n';
                    }
                } catch {
                    // ignore fetch failures for external styles
                }
            }
        }
    } catch {
        // ignore DOM access failures
    }

    // Write theme and tailwind aggregated assets
    try {
        await fs.writeFile(path.join(outputDir, 'assets', 'theme.css'), themeCss, 'utf8');
    } catch {
        // ignore write error
    }
    try {
        if (tailwindCss.trim().length > 0) {
            await fs.writeFile(path.join(outputDir, 'assets', 'tailwind.css'), tailwindCss, 'utf8');
        }
    } catch {
        // ignore
    }

    await fs.writeFile(path.join(outputDir, 'site.css'), fullCss, 'utf8');

    // 4. Emit page files
    for (const p of pageOutputs) {
        const outPath = path.join(outputDir, p.filename);
        await fs.writeFile(outPath, p.html, 'utf8');
    }

    // 4. Write index.html (first page)
    if (project.pageOrder.length > 0) {
        const firstPageId = project.pageOrder[0];
        await fs.copyFile(path.join(outputDir, `${firstPageId}.html`), path.join(outputDir, 'index.html'));
    }
}

// Note: server-side widget rendering is handled inline in renderWidgetToHtml

function renderPageHtml(page: Page, widgetBodies: string, project: LocalProject, innerWidth: number, height: number): string {
    const meta = project.portfolioMeta as PortfolioMeta | undefined;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${meta?.siteTitle || page.title}</title>
    <link rel="stylesheet" href="./assets/tailwind.css" />
    <link rel="stylesheet" href="./assets/theme.css" />
    <link rel="stylesheet" href="./site.css" />
</head>
<body>
    <main>
        <div class="container">
            <div class="page-canvas" style="height:${height}px;max-width:${innerWidth}px;">
                ${widgetBodies}
            </div>
        </div>
    </main>
</body>
</html>`;
}
