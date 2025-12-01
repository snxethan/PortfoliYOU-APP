export type PreviewStartResult = { ok: true; localUrl: string; lanUrl: string; port: number } | { ok: false; error: string };

export async function startPreviewServer(distDir: string, host?: string, port?: number): Promise<PreviewStartResult> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - window.api is exposed via preload
    const res = await window.api.previewStartServer({ distDir, host, port });
    return res as PreviewStartResult;
}

export async function stopPreviewServer(): Promise<{ ok: boolean; stopped?: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.api.previewStopServer();
}

export async function copyToClipboard(text: string): Promise<{ ok: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.api.clipboardWrite({ text });
}
