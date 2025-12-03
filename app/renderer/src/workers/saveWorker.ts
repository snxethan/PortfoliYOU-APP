import JSZip from 'jszip';

type AssetEntry = { hash: string; buffer: ArrayBuffer; meta?: unknown };

type Request = {
    type: 'serialize';
    payload: { _format: string; _version: number; exportedAt: string };
    projectMeta: unknown;
    pages: unknown;
    widgets: unknown;
    themes: unknown;
    assets: AssetEntry[];
};

type Response = { type: 'success'; base64: string } | { type: 'error'; error: string };

self.onmessage = async (ev: MessageEvent<Request>) => {
    const msg = ev.data;
    try {
        const zip = new JSZip();

        // Meta wrapper
        zip.file('project-meta.json', JSON.stringify({ ...msg.payload, project: msg.projectMeta }, null, 2));

        // Pages/widgets/themes as separate files
        zip.file('pages.json', JSON.stringify(msg.pages, null, 2));
        zip.file('widgets.json', JSON.stringify(msg.widgets, null, 2));
        zip.file('themes.json', JSON.stringify(msg.themes, null, 2));

        // Assets (already ArrayBuffers)
        if (msg.assets && msg.assets.length) {
            const folder = zip.folder('assets');
            for (const a of msg.assets) {
                try {
                    // a.buffer is ArrayBuffer; JSZip accepts Uint8Array or ArrayBuffer
                    folder?.file(a.hash, a.buffer);
                    if (a.meta) folder?.file(`${a.hash}.meta.json`, JSON.stringify(a.meta));
                } catch {
                    // ignore single asset failures
                }
            }
        }

        const base64 = await zip.generateAsync({ type: 'base64' });
        const resp: Response = { type: 'success', base64 };
        // Transfer nothing back (base64 is small-ish string)
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(resp);
    } catch (err) {
        const e = err instanceof Error ? err.message : String(err);
        const resp: Response = { type: 'error', error: e };
        (self as unknown as DedicatedWorkerGlobalScope).postMessage(resp);
    }
};
