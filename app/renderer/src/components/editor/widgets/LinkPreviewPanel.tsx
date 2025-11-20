import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ALLOWED_HTTP_SCHEME_LABEL, normalizeExternalLinkUrl } from '../../../widgets/utils/linkUrl';

type LinkPreviewPanelProps = {
    rawUrl: string;
    fieldError?: string | null;
    disabled?: boolean;
};

type LinkPreviewData = {
    url: string;
    title: string;
    description?: string;
    site?: string;
    image?: string;
};

type PreviewStatus = 'idle' | 'loading' | 'success' | 'error';

const PREVIEW_TIMEOUT_MS = 4500;

export default function LinkPreviewPanel({ rawUrl, fieldError, disabled }: LinkPreviewPanelProps) {
    const normalizedUrl = useMemo(() => normalizeExternalLinkUrl(rawUrl), [rawUrl]);
    const [preview, setPreview] = useState<LinkPreviewData | null>(null);
    const [status, setStatus] = useState<PreviewStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const fetchSeq = useRef(0);

    useEffect(() => {
        fetchSeq.current += 1; // invalidate inflight fetches when url changes
        setPreview((prev) => (prev && prev.url === normalizedUrl ? prev : null));
        setStatus('idle');
        setError(null);
    }, [normalizedUrl]);

    const urlState = useMemo(() => {
        const trimmed = rawUrl.trim();
        if (!trimmed) return 'empty';
        if (fieldError && fieldError.trim().length > 0) return 'error';
        if (!normalizedUrl) return 'invalid';
        return 'ready';
    }, [rawUrl, fieldError, normalizedUrl]);

    const canFetch = !disabled && urlState === 'ready' && status !== 'loading';

    const handleFetch = useCallback(async () => {
        if (!normalizedUrl) return;
        const seq = ++fetchSeq.current;
        setStatus('loading');
        setError(null);
        try {
            const data = await fetchOpenGraphPreview(normalizedUrl, PREVIEW_TIMEOUT_MS);
            if (fetchSeq.current !== seq) return; // aborted by url change
            setPreview({ ...data, url: normalizedUrl });
            setStatus('success');
        } catch (err) {
            if (fetchSeq.current !== seq) return;
            setPreview(null);
            setStatus('error');
            const message = err instanceof Error ? err.message : 'Failed to fetch preview';
            setError(message);
        }
    }, [normalizedUrl]);

    const statusMessage = (() => {
        if (status === 'loading') return 'Fetching metadata (up to ~4s)…';
        if (status === 'error' && error) return error;
        if (preview) return `Preview fetched from ${safeHostname(preview.url)}`;
        if (urlState === 'empty') return 'Add a URL to enable preview.';
        if (urlState === 'invalid') return `Only ${ALLOWED_HTTP_SCHEME_LABEL} links are supported.`;
        if (urlState === 'error' && fieldError) return fieldError;
        return 'Fetch the optional Open Graph preview to inspect titles, descriptions, and cover images.';
    })();

    return (
        <div className="mt-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--fg-muted)]">Link preview</div>
                    <div className="text-[10px] text-[color:var(--fg-muted)]">Optional metadata pull (timeout {PREVIEW_TIMEOUT_MS / 1000}s)</div>
                </div>
                <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleFetch}
                    disabled={!canFetch}
                >
                    {preview ? 'Refresh preview' : 'Fetch preview'}
                </button>
            </div>
            <div className="mt-2 text-xs text-[color:var(--fg-muted)]">
                {statusMessage}
            </div>
            <div className="mt-2 text-[10px] text-[color:var(--fg-muted)]">Supports {ALLOWED_HTTP_SCHEME_LABEL} links. Missing protocol defaults to https://.</div>
            {preview && (
                <div className="mt-3 flex gap-3 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-3">
                    <div className="w-24 flex-shrink-0">
                        {preview.image ? (
                            <img
                                src={preview.image}
                                alt="Link preview"
                                className="h-24 w-24 rounded object-cover border border-[color:var(--border)]"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-[color:var(--border)] text-[10px] text-[color:var(--fg-muted)]">
                                No image
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[color:var(--fg)]">{preview.title}</div>
                        {preview.description && (
                            <div className="mt-1 text-xs text-[color:var(--fg-muted)]">{preview.description}</div>
                        )}
                        <div className="mt-2 text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">
                            {preview.site || safeHostname(preview.url)}
                        </div>
                    </div>
                </div>
            )}
            {status === 'error' && error && (
                <div className="mt-2 text-xs text-red-500">{error}</div>
            )}
        </div>
    );
}

function safeHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

async function fetchOpenGraphPreview(url: string, timeoutMs: number): Promise<LinkPreviewData> {
    const bridge = typeof window !== 'undefined' ? window.api?.fetchText : undefined;
    if (bridge) {
        const response = await promiseWithTimeout(bridge({ url }), timeoutMs, 'Preview fetch timed out');
        if (!response?.ok || !response.text) {
            throw new Error(response?.error || 'Failed to fetch preview');
        }
        return parseOpenGraphHtml(response.text, url);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
        const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller?.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType && !contentType.includes('text/html')) {
            throw new Error('Preview only works for HTML pages');
        }
        const text = await res.text();
        return parseOpenGraphHtml(text, res.url || url);
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('Preview fetch timed out');
        }
        if (err instanceof TypeError) {
            throw new Error('Preview blocked by CORS. Use the desktop app to bypass browser limits.');
        }
        throw err instanceof Error ? err : new Error('Failed to fetch preview');
    } finally {
        clearTimeout(timer);
    }
}

function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }).catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function parseOpenGraphHtml(html: string, baseUrl: string): LinkPreviewData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const base = new URL(baseUrl);

    const pick = (...selectors: string[]): string | undefined => {
        for (const selector of selectors) {
            const node = doc.querySelector(selector);
            const content = node?.getAttribute('content') || node?.textContent;
            if (content && content.trim()) return content.trim();
        }
        return undefined;
    };

    const absolutize = (value?: string): string | undefined => {
        if (!value) return undefined;
        try {
            return new URL(value, base).toString();
        } catch {
            return undefined;
        }
    };

    const title = pick('meta[property="og:title"]', 'meta[name="twitter:title"]') || doc.querySelector('title')?.textContent?.trim() || base.hostname;
    const description = pick('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]');
    const image = absolutize(pick('meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]'));
    const site = pick('meta[property="og:site_name"]', 'meta[name="application-name"]', 'meta[property="og:url"]') || base.hostname;

    return {
        url: base.toString(),
        title,
        description,
        site,
        image,
    };
}
