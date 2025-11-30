import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type ProjectPayload = {
    project: any;
    assets: Record<string, string>; // base64
    outputDir?: string;
};

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWidgetToHtml(widget: any, assetsBase: string, placeholderUrl: string, pageFilenameMap?: Record<string, string>, collectCss?: (s: string) => void, themeColors?: any) {
    const type = widget?.type || 'unknown';
    const props = widget?.props || {};
    try {
        // helper to scope CSS to this widget instance
        const id = widget?.widgetId || widget?.id || String(Math.random()).slice(2);
        const pushCss = (s: string) => {
            if (!s || !collectCss) return;
            const trimmed = String(s).trim();
            if (!trimmed) return;
            // if contains selector blocks, include as-is; otherwise scope declarations
            if (/[{}]/.test(trimmed)) collectCss(trimmed);
            else collectCss(`.widget-instance-${id} { ${trimmed} }`);
        };
        switch (type) {
            case 'text': {
                const text = escapeHtml(String(props.text || ''));
                if ((props.format || 'plain') === 'markdown') {
                    return `<div class="widget widget-text"><div>${text}</div></div>`;
                }
                const variant = props.variant === 'h2' ? 'h2' : props.variant === 'h3' ? 'h3' : 'p';
                // collect text-specific CSS (alignment + variant sizing)
                pushCss(`text-align: ${props.align || 'left'}; color: var(--widget-fg); font-family: var(--heading-font);`);
                if (props.variant === 'h2') pushCss('font-size: 28px; font-weight: 700;');
                else if (props.variant === 'h3') pushCss('font-size: 20px; font-weight: 600;');
                else pushCss('font-size: 16px;');
                return `<div class="widget widget-text widget-instance-${id}"><${variant}>${text}</${variant}></div>`;
            }
            case 'image': {
                const src = String(props.src || '');
                const alt = escapeHtml(String(props.alt || props.imageAlt || ''));
                let url = placeholderUrl;
                if (src.startsWith('asset://')) url = path.posix.join(assetsBase, src.slice('asset://'.length));
                else if (src.startsWith('assets/')) url = path.posix.join(assetsBase, src.slice('assets/'.length));
                else if (src) url = src;
                // image-specific CSS (object-fit)
                pushCss(`display:block`);
                if (props.fit) pushCss(`max-width:100%`);
                return `<div class="widget widget-image widget-instance-${id}"><img src="${url}" alt="${alt}" loading="lazy"/></div>`;
            }
            case 'project': {
                const title = escapeHtml(String(props.title || 'Project'));
                const desc = escapeHtml(String(props.description || ''));
                let imgHtml = '';
                if (props.image) {
                    const imgSrc = props.image.startsWith('asset://') ? path.posix.join(assetsBase, props.image.slice('asset://'.length)) : props.image;
                    imgHtml = `<div class="proj-img"><img src="${imgSrc}" alt="${escapeHtml(props.imageAlt || '')}"/></div>`;
                }
                // project card styling
                pushCss(`color: var(--widget-fg);`);
                if (props.image) pushCss('.proj-img img { width:100%; height:260px; object-fit:cover; border-radius:8px; }');
                return `<article class="widget widget-project widget-instance-${id}">${imgHtml}<h3>${title}</h3><p>${desc}</p></article>`;
            }
            case 'link':
            case 'nav-link': {
                const label = escapeHtml(String(props.label || props.text || 'Link'));
                let href = String(props.href || props.link || props.url || '');
                // nav-link widgets in the editor point to a page by ID (targetPageId) or use a hash pattern #/page/<id>
                const targetId = (props.targetPageId || (href && href.startsWith('#/page/') ? href.split('/').pop() : null)) as string | null;
                if (targetId && pageFilenameMap && pageFilenameMap[targetId]) {
                    href = pageFilenameMap[targetId];
                }
                if (!href) href = '#';

                // Mirror renderer LinkView: support variants 'text', 'card', 'button' with inline styles
                const variant = (props.variant || 'button');
                const font = props.font || 'system';
                const fontSize = typeof props.fontSize === 'number' ? `${props.fontSize}px` : '16px';
                const weight = (props.weight === 'bold' ? 700 : 400);
                const italic = !!props.italic;

                const theme = themeColors || {};
                const borderColor = theme.border || 'var(--border)';
                const surface = theme.surface || 'var(--surface)';
                const textColor = theme.text || 'var(--fg)';
                const accent = theme.accent || 'var(--accent)';
                const buttonBg = theme.accent || 'var(--accent)';
                const buttonText = theme.widgetText || 'var(--widget-fg)';

                if (variant === 'text') {
                    const style = [`color: ${accent}`, `font-weight: ${weight}`, `text-decoration: underline`, `font-size: ${fontSize}`, `font-style: ${italic ? 'italic' : 'normal'}`].join(';');
                    return `<div class="widget widget-link widget-instance-${id}"><a href="${escapeHtml(href)}" style="${style}">${label}</a></div>`;
                }

                if (variant === 'card') {
                    const style = [
                        `display:block`,
                        `width:100%`,
                        `height:100%`,
                        `flex-direction:column`,
                        `justify-content:center`,
                        `gap:6px`,
                        `padding:16px`,
                        `border-radius:16px`,
                        `font-size:${fontSize}`,
                        `border:1px solid ${borderColor}`,
                        `background:${surface}`,
                        `box-shadow:0 8px 20px rgba(0,0,0,0.06)`,
                        `text-decoration:none`,
                        `color:${textColor}`
                    ].join(';');
                    const sub = `<span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${accent};opacity:0.9">Link</span><div style="display:flex;align-items:center;font-size:${fontSize};font-weight:${weight};font-style:${italic ? 'italic' : 'normal'};">${label}</div>`;
                    return `<div class="widget widget-link widget-instance-${id}"><a href="${escapeHtml(href)}" style="${style}">${sub}</a></div>`;
                }

                // default -> button
                const btnStyle = [
                    `display:inline-flex`,
                    `align-items:center`,
                    `gap:8px`,
                    `padding:10px 16px`,
                    `border-radius:999px`,
                    `border:2px solid ${borderColor}`,
                    `box-shadow:2px 2px 0 rgba(0,0,0,0.06)`,
                    `background:${buttonBg}`,
                    `color:${buttonText}`,
                    `text-decoration:none`,
                    `font-weight:${weight}`,
                    `font-style:${italic ? 'italic' : 'normal'}`,
                    `font-size:${fontSize}`
                ].join(';');
                return `<div class="widget widget-link widget-instance-${id}"><a href="${escapeHtml(href)}" style="${btnStyle}">${label}</a></div>`;
            }
            case 'video': {
                const src = String(props.src || '');
                let url = '';
                if (src.startsWith('asset://')) url = path.posix.join(assetsBase, src.slice('asset://'.length));
                else url = src;
                pushCss('max-width:100%');
                return `<div class="widget widget-video widget-instance-${id}"><video controls src="${url}">Your browser does not support video</video></div>`;
            }
            case 'carousel': {
                const slides = Array.isArray(props.slides) ? props.slides : [];
                const inner = slides.map((s: any) => {
                    const src = String(s.src || '');
                    const url = src.startsWith('asset://') ? path.posix.join(assetsBase, src.slice('asset://'.length)) : src;
                    return `<div class="slide"><img src="${url}" alt="${escapeHtml(String(s.alt || ''))}"/></div>`;
                }).join('\n');
                pushCss('.slides{display:flex;gap:8px;overflow:hidden} .slide img{width:100%;height:220px;object-fit:cover;border-radius:6px}');
                return `<div class="widget widget-carousel widget-instance-${id}"><div class="slides">${inner}</div></div>`;
            }
            default:
                return `<div class="widget widget-unknown widget-instance-${id}"><pre>${escapeHtml(JSON.stringify(props || {}, null, 2))}</pre></div>`;
        }
    } catch (e) {
        return `<div class="widget widget-error widget-instance-${widget?.widgetId || widget?.id}">[render error: ${escapeHtml(String(e))}]</div>`;
    }
}

export async function buildStaticSite(payload: ProjectPayload & { useTempOutput?: boolean }): Promise<{ ok: boolean; path?: string; error?: string }> {
    try {
        const project = payload.project || {};
        let out: string;
        if (payload.outputDir && !payload.useTempOutput) {
            // If an outputDir is provided (e.g. project folder), write the build
            // into a hidden `.portfoliyou/dist-site` subfolder to avoid littering
            // the chosen folder with many files.
            out = path.join(String(payload.outputDir), '.portfoliyou', 'dist-site');
        } else if (payload.useTempOutput) {
            // Build into a temp folder so we don't create a .portfoliyou directory
            // next to the user's project when we're going to embed the result into
            // the existing project file.
            const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'portfoliyou-build-'));
            out = path.join(tmpBase, 'dist-site');
        } else if (project && typeof project === 'object' && project._filePath) {
            try {
                const raw = String(project._filePath || '');
                // If the path points to a directory, use it directly; otherwise use its dirname
                let projectDir = path.dirname(raw);
                if (fsSync.existsSync(raw)) {
                    try {
                        const st = fsSync.lstatSync(raw);
                        if (st.isDirectory()) projectDir = raw;
                    } catch { /* ignore */ }
                }
                out = path.join(projectDir, '.portfoliyou', 'dist-site');
            } catch {
                out = path.join(process.cwd(), 'dist-site');
            }
        } else {
            out = path.join(process.cwd(), 'dist-site');
        }
        // remove existing
        if (fsSync.existsSync(out)) {
            await fs.rm(out, { recursive: true, force: true });
        }
        // Ensure the parent .portfoliyou directory exists when writing into a project
        await fs.mkdir(out, { recursive: true });
        const assetsOut = path.join(out, 'assets');
        await fs.mkdir(assetsOut, { recursive: true });

        // Write assets deterministically sorted by key
        const assetKeys = Object.keys(payload.assets || {}).sort();
        for (const hash of assetKeys) {
            const base64 = payload.assets[hash];
            const buf = Buffer.from(base64, 'base64');
            await fs.writeFile(path.join(assetsOut, hash), buf);
        }

        // Ensure placeholder exists
        const placeholderName = 'placeholder.png';
        const placeholderPath = path.join(assetsOut, placeholderName);
        if (!fsSync.existsSync(placeholderPath)) {
            // create a tiny 1x1 transparent PNG
            const tinyPng = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
                'base64'
            );
            await fs.writeFile(placeholderPath, tinyPng);
        }

        // Build site CSS from project theme when available (keeps compiled pages styled like the editor)
        const theme = (project && project.themes && project.themes[project.activeThemeId]) || null;
        const colors = (theme && theme.colors) || { background: '#ffffff', surface: '#f7f9fc', primary: '#0ea5e9', secondary: '#0f172a', accent: '#f97316', text: '#0f172a', muted: '#475569', border: '#e2e8f0', widgetBackground: '#ffffff', widgetText: '#0f172a' };
        const typography = (theme && theme.typography) || { heading: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif', scale: 1 };

        const baseCss = `:root{--bg:${colors.background};--fg:${colors.text};--muted:${colors.muted};--border:${colors.border};--accent:${colors.accent};--primary:${colors.primary};--surface:${colors.surface};--widget-bg:${colors.widgetBackground};--widget-fg:${colors.widgetText};--heading-font:${typography.heading};--body-font:${typography.body};--font-scale:${typography.scale}}body{font-family:var(--body-font),Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial;margin:0;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}a{color:var(--accent)}.container{max-width:1100px;margin:0 auto;padding:36px}.widget{margin-bottom:22px;background:var(--widget-bg);color:var(--widget-fg);padding:18px;border-radius:10px;border:1px solid var(--border);box-shadow:0 6px 18px rgba(0,0,0,0.04)}.widget img{max-width:100%;height:auto;border-radius:6px;display:block}.widget-text h2,.widget-text h3{font-family:var(--heading-font);margin:0 0 8px 0}.widget-text p{margin:0}.widget-project .proj-img img{width:100%;height:260px;object-fit:cover;border-radius:8px}.widget-link a{color:var(--accent);text-decoration:underline}.widget-video video{max-width:100%;border-radius:6px}.widget-carousel .slides{display:flex;gap:8px;overflow:hidden}.widget-carousel .slide img{width:100%;height:220px;object-fit:cover;border-radius:6px}.proj-img{margin-bottom:10px}.widget-project h3{margin:8px 0 6px 0}.widget-project p{margin:0;color:var(--muted)}.widget-unknown, .widget-error{font-family:monospace;background:transparent;border:1px dashed var(--border);padding:12px;border-radius:6px;white-space:pre-wrap}`;

        const collectedCss: string[] = [];

        const pages = Array.isArray(project.pageOrder) ? project.pageOrder : Object.keys(project.pages || {});
        const pagesMap = project.pages || {};
        // Build a deterministic filename map derived from page titles (slugified)
        const usedNames = new Set<string>();
        const pageFilenameMap: Record<string, string> = {};
        function slugify(title: string) {
            return title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
        }
        for (const pid of pages) {
            const pg = pagesMap[pid] || { title: String(pid) };
            const raw = String(pg.title || pid || 'page');
            let base = slugify(raw) || String(pid).slice(0, 8);
            // ensure uniqueness
            let candidate = base;
            let i = 1;
            while (usedNames.has(candidate)) {
                i += 1;
                candidate = `${base}-${i}`;
            }
            usedNames.add(candidate);
            pageFilenameMap[pid] = `${candidate}.html`;
        }

        // Render each page in order
        const assetsBase = 'assets';
        for (const pid of pages) {
            const pg = pagesMap[pid] || { title: String(pid), widgets: [] };
            const widgets = Array.isArray(pg.widgets) ? pg.widgets.map((wid: string) => project.widgets?.[wid]).filter(Boolean) : [];

            // Use the same canvas defaults as the editor so compiled pages mirror the canvas layout
            const COLS = 12;
            const GAP = 12; // px
            const ROW_H = 32; // px
            const CONTAINER_MAX_WIDTH = 1100; // matches .container max-width in base CSS
            const CONTAINER_PADDING = 36; // left+right padding used in .container
            const innerWidth = Math.max(0, CONTAINER_MAX_WIDTH - (CONTAINER_PADDING * 2));
            const colW = COLS > 0 ? Math.floor((innerWidth - GAP * (COLS - 1)) / COLS) : 0;

            // Compute content rows to determine canvas height
            const contentRows = widgets.length === 0 ? 12 : Math.max(12, ...widgets.map((w: any) => {
                const layout = w?.layout || w || {};
                return (typeof layout.y === 'number' ? layout.y : (typeof w?.y === 'number' ? w.y : 0)) + (typeof layout.h === 'number' ? layout.h : (typeof w?.h === 'number' ? w.h : 1));
            }));
            const height = contentRows * ROW_H + (contentRows - 1) * GAP;

            // Build absolutely-positioned widget wrappers so compiled pages match the canvas
            const widgetBodies = widgets.map((w: any, index: number) => {
                const layout = w?.layout || w || {};
                const lx = typeof layout.x === 'number' ? layout.x : (typeof w?.x === 'number' ? w.x : 0);
                const ly = typeof layout.y === 'number' ? layout.y : (typeof w?.y === 'number' ? w.y : 0);
                const lw = typeof layout.w === 'number' ? layout.w : (typeof w?.w === 'number' ? w.w : 1);
                const lh = typeof layout.h === 'number' ? layout.h : (typeof w?.h === 'number' ? w.h : 1);
                const lz = typeof layout.z === 'number' ? layout.z : (typeof w?.z === 'number' ? w.z : index);

                const left = lx * (colW + GAP);
                const top = ly * (ROW_H + GAP);
                const wPx = lw * colW + (lw - 1) * GAP;
                const hPx = lh * ROW_H + (lh - 1) * GAP;
                const z = 100 + (typeof lz === 'number' ? lz : index);

                const inner = renderWidgetToHtml(w, assetsBase, path.posix.join(assetsBase, placeholderName), pageFilenameMap, (s: string) => collectedCss.push(s), colors);
                return `<div class="page-widget-wrapper" style="position:absolute;left:${left}px;top:${top}px;width:${wPx}px;height:${hPx}px;z-index:${z};">${inner}</div>`;
            }).join('\n');

            const title = escapeHtml(String(pg.title || project.portfolioMeta?.siteTitle || 'Portfolio'));
            const pageBg = pg.backgroundColor || colors.background;
            const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width,initial-scale=1" />\n  <title>${title}</title>\n  <link rel="stylesheet" href="/site.css" />\n</head>\n<body style="background:${pageBg};">\n  <div class="container">\n    <h1>${title}</h1>\n    <div class=\"page-canvas\" style=\"position:relative;height:${height}px;max-width:${innerWidth}px;margin:0 auto;\">\n      ${widgetBodies}\n    </div>\n  </div>\n  <script src="/site.js"></script>\n</body>\n</html>`;

            // Use slugified filename
            await fs.writeFile(path.join(out, pageFilenameMap[pid]), html, 'utf8');
        }

        // After building all pages, write aggregated CSS (base + collected widget CSS)
        const finalCss = [baseCss, ...collectedCss].join('\n\n');
        await fs.writeFile(path.join(out, 'site.css'), finalCss, 'utf8');

        // Copy first page to index.html for root
        if (pages.length > 0) {
            const first = pages[0];
            const firstPath = path.join(out, pageFilenameMap[first]);
            if (fsSync.existsSync(firstPath)) {
                await fs.copyFile(firstPath, path.join(out, 'index.html'));
            }
        }

        // Add a small site JS to enable basic interactive widgets (carousel)
        const siteJs = `document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.widget-carousel').forEach(function(car){const slides=Array.from(car.querySelectorAll('.slide'));if(slides.length<=1)return;let idx=0;slides.forEach((s,i)=>{s.style.display=(i===0?'block':'none');});const next=function(){slides[idx].style.display='none';idx=(idx+1)%slides.length;slides[idx].style.display='block';};setInterval(next,3500);});});`;
        await fs.writeFile(path.join(out, 'site.js'), siteJs, 'utf8');

        return { ok: true, path: out };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}
