import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { useAssets } from '../../providers/AssetsProvider';
import type { VideoWidgetProps } from '../videoProps';
import {
    COLOR_OR_VAR,
    VIDEO_BASE_FALLBACK,
    VIDEO_BASE_TITLE,
    defaultVideoProps,
    isAssetScheme,
    isLegacyAssetPath,
    sanitizeText,
    sanitizeUrlish,
    sanitizeVideoProps,
} from '../videoProps';

type Props = VideoWidgetProps;

type ProviderType = 'youtube' | 'file' | 'unknown';

type ResolvedAssetState = {
    url: string | null;
    resolving: boolean;
};

function useResolvedAssetUrl(src?: string): ResolvedAssetState {
    const { getUrl } = useAssets();
    const [state, setState] = useState<ResolvedAssetState>({ url: null, resolving: false });
    useEffect(() => {
        let alive = true;
        async function go() {
            if (!src) {
                if (alive) setState({ url: null, resolving: false });
                return;
            }
            if (isAssetScheme(src)) {
                if (alive) setState({ url: null, resolving: true });
                const hash = src.slice('asset://'.length);
                try {
                    const url = await getUrl(hash);
                    if (alive) setState({ url: url, resolving: false });
                } catch {
                    if (alive) setState({ url: null, resolving: false });
                }
                return;
            }
            if (isLegacyAssetPath(src)) {
                if (alive) setState({ url: null, resolving: false });
                return;
            }
            if (alive) setState({ url: src, resolving: false });
        }
        void go();
        return () => { alive = false; };
    }, [src, getUrl]);
    return state;
}

function extractYouTubeId(raw: string): string | null {
    if (!raw) return null;
    try {
        const url = new URL(raw);
        const host = url.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            const part = url.pathname.split('/').filter(Boolean)[0];
            return part || null;
        }
        if (host.endsWith('youtube.com')) {
            const idFromQuery = url.searchParams.get('v');
            if (idFromQuery) return idFromQuery;
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
                return segments[1] || null;
            }
        }
    } catch {
        return null;
    }
    return null;
}

function detectProvider(src: string): ProviderType {
    if (!src) return 'unknown';
    if (extractYouTubeId(src)) return 'youtube';
    if (isAssetScheme(src) || isLegacyAssetPath(src)) return 'file';
    if (/^(https?:|data:|blob:)/i.test(src)) return 'file';
    return 'file';
}


function buildYouTubeEmbedUrl(id: string, opts: { autoplay: boolean; muted: boolean; controls: boolean; loop: boolean; playsInline: boolean }) {
    const params = new URLSearchParams();
    params.set('rel', '0');
    params.set('modestbranding', '1');
    params.set('playsinline', opts.playsInline ? '1' : '0');
    params.set('controls', opts.controls ? '1' : '0');
    params.set('autoplay', opts.autoplay ? '1' : '0');
    params.set('mute', opts.muted ? '1' : '0');
    if (opts.loop) {
        params.set('loop', '1');
        params.set('playlist', id);
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function Placeholder({ message }: { message: string }) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center text-[color:var(--fg-muted)] text-xs px-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[color:var(--fg-muted)]/80">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
            </svg>
            <span>{message}</span>
        </div>
    );
}

function Fallback({ message }: { message: string }) {
    return <Placeholder message={message} />;
}

function LegacyAssetWarning() {
    return <Placeholder message="This video reference is from an older project export. Re-import the file to update the asset." />;
}

function LoadingState() {
    return <Placeholder message="Resolving video…" />;
}

function FileVideoPlayer({
    src,
    poster,
    fallbackMessage,
    showControls,
    autoPlay,
    muted,
    loop,
    playsInline,
    title,
}: {
    src: string;
    poster?: string;
    fallbackMessage: string;
    showControls: boolean;
    autoPlay: boolean;
    muted: boolean;
    loop: boolean;
    playsInline: boolean;
    title?: string;
}) {
    const { url, resolving } = useResolvedAssetUrl(src);
    const posterState = useResolvedAssetUrl((poster || '').trim());
    const [errored, setErrored] = useState(false);

    if (resolving && !url) {
        return <LoadingState />;
    }

    if (!url || errored) {
        return <Fallback message={fallbackMessage} />;
    }

    return (
        <video
            src={url}
            poster={posterState.url || undefined}
            controls={showControls}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            playsInline={playsInline}
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
            title={title || 'Embedded video'}
            onError={() => setErrored(true)}
        />
    );
}

function YouTubeEmbed({
    src,
    fallbackMessage,
    autoplay,
    muted,
    controls,
    loop,
    playsInline,
    allowFullscreen,
    title,
}: {
    src: string;
    fallbackMessage: string;
    autoplay: boolean;
    muted: boolean;
    controls: boolean;
    loop: boolean;
    playsInline: boolean;
    allowFullscreen: boolean;
    title?: string;
}) {
    const videoId = useMemo(() => extractYouTubeId(src), [src]);
    if (!videoId) {
        return <Fallback message={fallbackMessage} />;
    }
    const embedUrl = useMemo(() => buildYouTubeEmbedUrl(videoId, { autoplay, muted, controls, loop, playsInline }), [videoId, autoplay, muted, controls, loop, playsInline]);
    return (
        <iframe
            src={embedUrl}
            title={title || 'Embedded video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen={allowFullscreen}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
        />
    );
}

const def: WidgetDefinition<Props> = {
    type: 'video',
    label: 'Video',
    version: 1,
    defaultProps: defaultVideoProps,
    grid: { w: 6, h: 4 },
    render: (props) => {
        const safe = sanitizeVideoProps(props);
        const src = safe.src;
        const provider = detectProvider(src);
        const fallbackMessage = safe.fallbackText || 'Video is unavailable.';
        const shape = safe.shape || 'rectangle';
        const radius = shape === 'circle' ? '999px' : shape === 'rounded' ? Math.max(0, safe.borderRadius ?? 12) : Math.max(0, safe.borderRadius ?? 0);
        const background = safe.backgroundColor || 'var(--surface)';
        const borderWidth = Math.max(0, safe.borderWidth ?? 0);
        const borderColor = safe.borderColor || 'var(--border)';
        const borderStyle = safe.borderStyle || 'solid';
        const shouldAutoplay = Boolean(safe.autoplay);
        const shouldMute = shouldAutoplay ? true : safe.muted !== false;
        const showControls = safe.controls !== false;
        const playsInline = safe.playsInline !== false;
        const allowFullscreen = safe.allowFullscreen !== false;

        const wrapperStyle: React.CSSProperties = {
            width: '100%',
            height: '100%',
            borderRadius: radius,
            overflow: 'hidden',
            background,
            border: borderWidth > 0 ? `${borderWidth}px ${borderStyle} ${borderColor}` : '1px solid var(--border)',
            boxSizing: 'border-box',
            position: 'relative',
        };

        const legacy = isLegacyAssetPath(src);

        if (!src) {
            return (
                <div style={wrapperStyle}>
                    <Placeholder message="Drop a video file or paste a YouTube link to get started." />
                </div>
            );
        }

        if (legacy) {
            return (
                <div style={wrapperStyle}>
                    <LegacyAssetWarning />
                </div>
            );
        }

        if (provider === 'youtube') {
            return (
                <div style={wrapperStyle}>
                    <YouTubeEmbed
                        src={src}
                        fallbackMessage={fallbackMessage}
                        autoplay={shouldAutoplay}
                        muted={shouldMute}
                        controls={showControls}
                        loop={Boolean(safe.loop)}
                        playsInline={playsInline}
                        allowFullscreen={allowFullscreen}
                        title={safe.title}
                    />
                </div>
            );
        }

        if (provider === 'file') {
            return (
                <div style={wrapperStyle}>
                    <FileVideoPlayer
                        src={src}
                        poster={safe.poster}
                        fallbackMessage={fallbackMessage}
                        showControls={showControls}
                        autoPlay={shouldAutoplay}
                        muted={shouldMute}
                        loop={Boolean(safe.loop)}
                        playsInline={playsInline}
                        title={safe.title}
                    />
                </div>
            );
        }

        return (
            <div style={wrapperStyle}>
                <Fallback message={fallbackMessage} />
            </div>
        );
    },
    zodSchema: z.object({
        src: z.string().refine((value) => {
            if (value.trim() === '') return true;
            if (value.startsWith('asset://') || value.startsWith('assets/')) return true;
            if (/^(https?:|data:|blob:)/i.test(value)) return true;
            try {
                const url = new URL(value);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch {
                return false;
            }
        }, { message: 'Enter a valid video URL or choose an uploaded asset.' }).transform((value) => sanitizeUrlish(value) || ''),
        poster: z.string().optional().refine((value) => {
            if (!value || value.trim() === '') return true;
            if (value.startsWith('asset://') || value.startsWith('assets/')) return true;
            if (/^(https?:|data:|blob:)/i.test(value)) return true;
            try {
                const url = new URL(value);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch {
                return false;
            }
        }, { message: 'Poster must be a valid URL or asset reference.' }).transform((value) => {
            const safe = sanitizeUrlish(value);
            return safe || undefined;
        }),
        title: z.string().optional().transform((value) => sanitizeText(value, VIDEO_BASE_TITLE, 120)),
        autoplay: z.boolean().optional(),
        muted: z.boolean().optional(),
        loop: z.boolean().optional(),
        controls: z.boolean().optional(),
        playsInline: z.boolean().optional(),
        allowFullscreen: z.boolean().optional(),
        fallbackText: z.string().optional().transform((value) => sanitizeText(value, VIDEO_BASE_FALLBACK, 300)),
        backgroundColor: z.string().optional().transform((value) => (value && value.trim()) ? value.trim() : defaultVideoProps.backgroundColor),
        borderRadius: z.number().min(0).max(240).optional(),
        shape: z.enum(['rectangle', 'rounded', 'circle']).optional(),
        borderWidth: z.number().min(0).max(48).optional(),
        borderColor: z.string().regex(COLOR_OR_VAR).optional(),
        borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    }),
};

export default def;
