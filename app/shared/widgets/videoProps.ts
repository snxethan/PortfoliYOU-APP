export type VideoWidgetProps = {
    src: string;
    poster?: string;
    title?: string;
    ariaLabel?: string;
    ariaDescription?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    playsInline?: boolean;
    allowFullscreen?: boolean;
    fallbackText?: string;
    backgroundColor?: string;
    borderRadius?: number;
    shape?: 'rectangle' | 'rounded' | 'circle';
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
};

const SHAPES = new Set(['rectangle', 'rounded', 'circle']);
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted']);
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CSS_VAR = /^var\(--[a-z0-9_-]+\)$/i;
export const COLOR_OR_VAR = /^(#([0-9a-f]{3}|[0-9a-f]{6})|var\(--[a-z0-9_-]+\))$/i;
const SCRIPT_TAG = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

export function isAssetScheme(src: string) {
    return typeof src === 'string' && src.startsWith('asset://');
}

export function isLegacyAssetPath(src: string) {
    return typeof src === 'string' && src.startsWith('assets/');
}

export const VIDEO_BASE_TITLE = 'Embedded video';
export const VIDEO_BASE_FALLBACK = 'Video is unavailable. Please check the link or upload a new file.';

export const defaultVideoProps: VideoWidgetProps = {
    src: '',
    title: VIDEO_BASE_TITLE,
    ariaLabel: undefined,
    ariaDescription: undefined,
    autoplay: false,
    muted: true,
    loop: false,
    controls: true,
    playsInline: true,
    allowFullscreen: true,
    fallbackText: VIDEO_BASE_FALLBACK,
    backgroundColor: 'var(--surface)',
    borderRadius: 12,
    shape: 'rectangle',
    borderWidth: 0,
    borderColor: '#e5e7eb',
    borderStyle: 'solid',
};

export function sanitizeUrlish(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (isAssetScheme(trimmed) || isLegacyAssetPath(trimmed)) return trimmed;
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    try {
        const url = new URL(trimmed);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch {
        return '';
    }
    return '';
}

function sanitizeColor(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (HEX_COLOR.test(trimmed) || CSS_VAR.test(trimmed)) return trimmed;
    return fallback;
}

export function sanitizeText(value: unknown, fallback: string, max = 300) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const noScripts = trimmed.replace(SCRIPT_TAG, '');
    const withoutTags = noScripts.replace(/<[^>]*>/g, '');
    return withoutTags.slice(0, max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function coerceBoolean(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowered = value.toLowerCase();
        if (['true', '1', 'yes'].includes(lowered)) return true;
        if (['false', '0', 'no'].includes(lowered)) return false;
    }
    return fallback;
}

export function sanitizeVideoProps(raw?: Partial<VideoWidgetProps>): VideoWidgetProps {
    const input = raw ?? {};
    const safe: VideoWidgetProps = { ...defaultVideoProps };
    safe.src = sanitizeUrlish(input.src) || '';
    const poster = sanitizeUrlish(input.poster);
    safe.poster = poster || undefined;
    safe.title = sanitizeText(input.title, defaultVideoProps.title || VIDEO_BASE_TITLE);
    const ariaLabel = sanitizeText(input.ariaLabel, '', 160);
    safe.ariaLabel = ariaLabel ? ariaLabel : undefined;
    const ariaDescription = sanitizeText(input.ariaDescription, '', 320);
    safe.ariaDescription = ariaDescription ? ariaDescription : undefined;
    safe.fallbackText = sanitizeText(input.fallbackText, defaultVideoProps.fallbackText || VIDEO_BASE_FALLBACK);
    safe.autoplay = coerceBoolean(input.autoplay, defaultVideoProps.autoplay ?? false);
    safe.muted = coerceBoolean(input.muted, defaultVideoProps.muted ?? true);
    safe.loop = coerceBoolean(input.loop, defaultVideoProps.loop ?? false);
    safe.controls = coerceBoolean(input.controls, defaultVideoProps.controls ?? true);
    safe.playsInline = coerceBoolean(input.playsInline, defaultVideoProps.playsInline ?? true);
    safe.allowFullscreen = coerceBoolean(input.allowFullscreen, defaultVideoProps.allowFullscreen ?? true);
    safe.backgroundColor = typeof input.backgroundColor === 'string' && input.backgroundColor.trim() ? input.backgroundColor.trim() : defaultVideoProps.backgroundColor;
    safe.shape = SHAPES.has((input.shape as string) || '') ? (input.shape as VideoWidgetProps['shape']) : defaultVideoProps.shape;
    safe.borderWidth = clampNumber(input.borderWidth, 0, 48, defaultVideoProps.borderWidth ?? 0);
    safe.borderRadius = clampNumber(input.borderRadius, 0, 240, defaultVideoProps.borderRadius ?? 0);
    safe.borderColor = sanitizeColor(input.borderColor, defaultVideoProps.borderColor ?? '#e5e7eb');
    safe.borderStyle = BORDER_STYLES.has((input.borderStyle as string) || '') ? (input.borderStyle as VideoWidgetProps['borderStyle']) : defaultVideoProps.borderStyle;
    return safe;
}
