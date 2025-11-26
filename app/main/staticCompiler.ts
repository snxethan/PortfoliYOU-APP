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

function renderWidgetToHtml(widget: any, assetsBase: string, placeholderUrl: string, pageFilenameMap?: Record<string, string>) {
    const type = widget?.type || 'unknown';
    const props = widget?.props || {};
    try {
        switch (type) {
            case 'text': {
                const text = escapeHtml(String(props.text || ''));
                if ((props.format || 'plain') === 'markdown') {
                    return `<div class="widget widget-text"><div>${text}</div></div>`;
                }
                const variant = props.variant === 'h2' ? 'h2' : props.variant === 'h3' ? 'h3' : 'p';
                return `<div class="widget widget-text"><${variant}>${text}</${variant}></div>`;
            }
            case 'image': {
                const src = String(props.src || '');
                const alt = escapeHtml(String(props.alt || props.imageAlt || ''));
                let url = placeholderUrl;
                if (src.startsWith('asset://')) url = path.posix.join(assetsBase, src.slice('asset://'.length));
                else if (src.startsWith('assets/')) url = path.posix.join(assetsBase, src.slice('assets/'.length));
                else if (src) url = src;
                return `<div class="widget widget-image"><img src="${url}" alt="${alt}" loading="lazy"/></div>`;
            }
            case 'project': {
                const title = escapeHtml(String(props.title || 'Project'));
                const desc = escapeHtml(String(props.description || ''));
                let imgHtml = '';
                if (props.image) {
                    const imgSrc = props.image.startsWith('asset://') ? path.posix.join(assetsBase, props.image.slice('asset://'.length)) : props.image;
                    imgHtml = `<div class="proj-img"><img src="${imgSrc}" alt="${escapeHtml(props.imageAlt || '')}"/></div>`;
                }
                return `<article class="widget widget-project">${imgHtml}<h3>${title}</h3><p>${desc}</p></article>`;
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
                return `<div class="widget widget-link"><a href="${escapeHtml(href)}">${label}</a></div>`;
            }
            case 'video': {
                const src = String(props.src || '');
                let url = '';
                if (src.startsWith('asset://')) url = path.posix.join(assetsBase, src.slice('asset://'.length));
                else url = src;
                return `<div class="widget widget-video"><video controls src="${url}">Your browser does not support video</video></div>`;
            }
            case 'carousel': {
                const slides = Array.isArray(props.slides) ? props.slides : [];
                const inner = slides.map((s: any) => {
                    const src = String(s.src || '');
                    const url = src.startsWith('asset://') ? path.posix.join(assetsBase, src.slice('asset://'.length)) : src;
                    return `<div class="slide"><img src="${url}" alt="${escapeHtml(String(s.alt || ''))}"/></div>`;
                }).join('\n');
                return `<div class="widget widget-carousel"><div class="slides">${inner}</div></div>`;
            }
            default:
                return `<div class="widget widget-unknown"><pre>${escapeHtml(JSON.stringify(props || {}, null, 2))}</pre></div>`;
        }
    } catch (e) {
        return `<div class="widget widget-error">[render error: ${escapeHtml(String(e))}]</div>`;
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

        // Basic site CSS - lightweight and deterministic
        const css = `:root{--bg:#fff;--fg:#111;--muted:#666;--border:#e6e6e6}body{font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;margin:0;color:var(--fg);background:var(--bg)}.container{max-width:900px;margin:0 auto;padding:24px}.widget{margin-bottom:18px}.widget img{max-width:100%;height:auto;border-radius:6px}.widget-project .proj-img img{width:100%;height:240px;object-fit:cover;border-radius:6px}`;
        await fs.writeFile(path.join(out, 'site.css'), css, 'utf8');

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
            const body = widgets.map((w: any) => renderWidgetToHtml(w, assetsBase, path.posix.join(assetsBase, placeholderName), pageFilenameMap)).join('\n');
            const title = escapeHtml(String(pg.title || project.portfolioMeta?.siteTitle || 'Portfolio'));
            const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width,initial-scale=1" />\n  <title>${title}</title>\n  <link rel="stylesheet" href="/site.css" />\n</head>\n<body>\n  <div class="container">\n    <h1>${title}</h1>\n    ${body}\n  </div>\n  <script src="/site.js"></script>\n</body>\n</html>`;
            // Use slugified filename
            await fs.writeFile(path.join(out, pageFilenameMap[pid]), html, 'utf8');
        }

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
