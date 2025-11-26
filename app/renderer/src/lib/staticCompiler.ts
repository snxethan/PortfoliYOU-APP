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

    // 2. Generate CSS (basic stub, extend as needed)
    const css = `body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }`;
    await fs.writeFile(path.join(outputDir, 'site.css'), css);

    // 3. Generate HTML for each page
    for (const pageId of project.pageOrder) {
        const page = project.pages[pageId];
        if (!page) continue;
        const widgets = (page.widgets || []).map(wid => project.widgets[wid]).filter(Boolean);
        const widgetEls = widgets.map(widget => renderWidget(widget, project));
        const html = renderPageHtml(page, widgetEls, project);
        const outPath = path.join(outputDir, `${pageId}.html`);
        await fs.writeFile(outPath, html);
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
