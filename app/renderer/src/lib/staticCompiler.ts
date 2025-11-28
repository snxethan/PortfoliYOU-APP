import fs from 'fs-extra';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { LocalProject, Widget, Page, PortfolioMeta } from '../providers/ProjectsProvider';
import type { Theme } from '../themes/types';
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
        } catch (e) {
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
        } catch (e) {
            // ignore CSS generation errors
        }

        // Render widget markup (use provided render function if available)
        if (def && typeof def.render === 'function') {
            try {
                const el = def.render(props);
                const inner = ReactDOMServer.renderToStaticMarkup(el as any);
                // Wrap each widget with an instance-scoped class so per-instance CSS can target it
                return `<div class="widget widget-instance-${widget.widgetId || widget.id}">${inner}</div>`;
            } catch (e) {
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
        const html = renderPageHtml(page, widgetHtmls.map(h => ({ toString: () => h })) as any, project);
        pageOutputs.push({ filename: `${pageId}.html`, html });
    }

    // 3. Write aggregated CSS (base + widget-specific)
    const baseCss = `body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }`;
    const fullCss = [baseCss, ...collectedCss].join('\n\n');
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

function renderWidget(widget: Widget, project: LocalProject): React.ReactElement {
    const def = WidgetsRegistry.get(widget.type);
    if (!def || !def.render) return React.createElement('div', {}, `[Unknown widget: ${widget.type}]`);
    // Asset src handling
    let props: any = {};
    if (typeof widget.props === 'object' && widget.props !== null) {
        props = { ...widget.props };
    }
    if (typeof props.src === 'string' && props.src.startsWith('asset://')) {
        const hash = props.src.slice('asset://'.length);
        props.src = `/assets/${hash}`;
    }
    // Add more asset fields as needed
    return def.render(props);
}

function renderPageHtml(page: Page, widgetEls: React.ReactElement[], project: LocalProject): string {
    const meta = project.portfolioMeta as PortfolioMeta | undefined;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta?.siteTitle || page.title}</title>
  <link rel="stylesheet" href="/site.css" />
</head>
<body>
  <main>
    ${widgetEls.map(el => ReactDOMServer.renderToStaticMarkup(el)).join('\n')}
  </main>
</body>
</html>`;
}
