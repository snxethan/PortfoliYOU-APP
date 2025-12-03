import { useCallback, useState } from 'react';

import { startPreviewServer, stopPreviewServer, copyToClipboard } from '../lib/previewServer';

export default function usePreviewServer() {
    const [running, setRunning] = useState(false);
    const [localUrl, setLocalUrl] = useState<string | null>(null);
    const [lanUrl, setLanUrl] = useState<string | null>(null);
    const [port, setPort] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const start = useCallback(async (distDir: string) => {
        setError(null);
        try {
            const res = await startPreviewServer(distDir);
            if (res && (res as any).ok) {
                setRunning(true);
                setLocalUrl((res as any).host);
                // Only expose LAN URL when it's not localhost or loopback
                const lan = (res as any).lan;
                if (lan && !lan.startsWith('http://127.') && !lan.startsWith('http://localhost') && !lan.startsWith('http://[::1]')) {
                    setLanUrl(lan);
                } else {
                    setLanUrl(null);
                }
                setPort((res as any).port || null);
            } else {
                setError((res as any).error || 'Failed to start');
            }
        } catch (e) {
            setError(String(e));
        }
    }, []);

    const stop = useCallback(async () => {
        setError(null);
        try {
            const res = await stopPreviewServer();
            if (res && (res as any).ok) {
                setRunning(false);
                setLocalUrl(null);
                setLanUrl(null);
                setPort(null);
            } else {
                setError((res as any).error || 'Failed to stop');
            }
        } catch (e) {
            setError(String(e));
        }
    }, []);

    const copy = useCallback(async (which: 'local' | 'lan' = 'local') => {
        const url = which === 'lan' ? lanUrl : localUrl;
        if (!url) return { ok: false, error: 'No URL' };
        try {
            const res = await copyToClipboard(url);
            return res;
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    }, [localUrl, lanUrl]);

    return {
        running,
        localUrl,
        lanUrl,
        port,
        error,
        start,
        stop,
        copy,
    } as const;
}
