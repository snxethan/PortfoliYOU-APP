import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

import { FALLBACK_WIDGET_THEME, themeSnapshotToCss, type WidgetThemeSnapshot } from '../shared/staticStyles';
import { normalizeExternalLinkUrl } from '../shared/widgets/linkUrl';
import {
    sanitizeVideoProps,
    isAssetScheme,
    isLegacyAssetPath,
    VIDEO_BASE_FALLBACK,
} from '../shared/widgets/videoProps';

const dom = new JSDOM('');
const DOMPurify = createDOMPurify(dom.window as unknown as typeof globalThis);

const FONT_STACK_SYSTEM = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
const FONT_STACK_SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const FONT_STACK_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type TextVariant = 'paragraph' | 'h2' | 'h3';
type TextAlign = 'left' | 'center' | 'right';
type FontChoice = 'system' | 'serif' | 'mono';
type TextWeight = 'normal' | 'bold';
type LinkVariant = 'text' | 'button' | 'card';

type SanitizedTextProps = {
    text: string;
    variant: TextVariant;
    align: TextAlign;
    fontFamily: string;
    color?: string;
    fontSize?: number;
    weight?: TextWeight;
    italic: boolean;
    format: 'plain' | 'markdown';
    ariaLabel?: string;
    ariaDescription?: string;
};

type SanitizedLinkProps = {
    url: string;
    label: string;
    variant: LinkVariant;
    iconLeft?: string;
    iconRight?: string;
    font: FontChoice;
    fontSize: number;
    weight: TextWeight;
    italic: boolean;
    ariaLabel?: string;
    ariaDescription?: string;
};

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function sanitizeTextProps(raw: any): SanitizedTextProps {
    const text = typeof raw?.text === 'string' ? raw.text : '';
    const variant: TextVariant = raw?.variant === 'h2' ? 'h2' : raw?.variant === 'h3' ? 'h3' : 'paragraph';
    const align: TextAlign = raw?.align === 'center' || raw?.align === 'right' ? raw.align : 'left';
    const fontChoice: FontChoice = raw?.font === 'serif' ? 'serif' : raw?.font === 'mono' ? 'mono' : 'system';
    const fontFamily = fontChoice === 'serif' ? FONT_STACK_SERIF : fontChoice === 'mono' ? FONT_STACK_MONO : FONT_STACK_SYSTEM;
    const color = typeof raw?.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined;
    const fontSize = typeof raw?.fontSize === 'number' && !Number.isNaN(raw.fontSize) ? clamp(raw.fontSize, 8, 128) : undefined;
    const weight: TextWeight | undefined = raw?.weight === 'bold' ? 'bold' : raw?.weight === 'normal' ? 'normal' : undefined;
    const italic = Boolean(raw?.italic);
    const format: 'plain' | 'markdown' = raw?.format === 'markdown' ? 'markdown' : 'plain';
    const ariaLabel = typeof raw?.ariaLabel === 'string' && raw.ariaLabel.trim() ? raw.ariaLabel.trim() : undefined;
    const ariaDescription = typeof raw?.ariaDescription === 'string' && raw.ariaDescription.trim() ? raw.ariaDescription.trim() : undefined;
    return { text, variant, align, fontFamily, color, fontSize, weight, italic, format, ariaLabel, ariaDescription };
}

function sanitizeIcon(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, 24);
}

function sanitizeLinkProps(raw: any): SanitizedLinkProps {
    const url = normalizeExternalLinkUrl(raw?.url);
    const label = typeof raw?.label === 'string' && raw.label.trim() ? raw.label.trim() : 'Visit site';
    const variant: LinkVariant = raw?.variant === 'text' || raw?.variant === 'card' ? raw.variant : 'button';
    const font: FontChoice = raw?.font === 'serif' ? 'serif' : raw?.font === 'mono' ? 'mono' : 'system';
    const fontSize = typeof raw?.fontSize === 'number' && !Number.isNaN(raw.fontSize) ? clamp(raw.fontSize, 8, 128) : 16;
    const weight: TextWeight = raw?.weight === 'normal' ? 'normal' : 'bold';
    const italic = Boolean(raw?.italic);
    const iconLeft = sanitizeIcon(raw?.iconLeft);
    const iconRight = sanitizeIcon(raw?.iconRight);
    const ariaLabel = typeof raw?.ariaLabel === 'string' && raw.ariaLabel.trim() ? raw.ariaLabel.trim() : undefined;
    const ariaDescription = typeof raw?.ariaDescription === 'string' && raw.ariaDescription.trim() ? raw.ariaDescription.trim() : undefined;
    return { url, label, variant, iconLeft, iconRight, font, fontSize, weight, italic, ariaLabel, ariaDescription };
}

function fontFamilyForChoice(choice: FontChoice, theme?: WidgetThemeSnapshot): string {
    if (choice === 'serif') return FONT_STACK_SERIF;
    if (choice === 'mono') return FONT_STACK_MONO;
    return theme?.bodyFont || FONT_STACK_SYSTEM;
}

function renderMarkdownToHtml(source: string): string {
    if (!source) return '';
    const raw = marked.parse(source, { async: false }) as string;
    return DOMPurify.sanitize(String(raw));
}

const IMAGE_SHAPES = new Set(['rectangle', 'rounded', 'circle']);
const IMAGE_BORDER_STYLES = new Set(['solid', 'dashed', 'dotted']);
const IMAGE_FITS = new Set(['contain', 'cover', 'fill', 'none', 'scale-down']);

type SanitizedImageProps = {
    src: string;
    alt: string;
    fit: string;
    shape: 'rectangle' | 'rounded' | 'circle';
    radius: number;
    borderWidth: number;
    borderColor: string;
    borderStyle: 'solid' | 'dashed' | 'dotted';
    scale: number;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function sanitizeImageProps(raw: any): SanitizedImageProps {
    const input = raw || {};
    const src = typeof input.src === 'string' ? input.src.trim() : '';
    const alt = typeof input.alt === 'string' && input.alt.trim() ? input.alt.trim() : 'Image';
    const fit = typeof input.fit === 'string' && IMAGE_FITS.has(input.fit) ? input.fit : 'contain';
    const shape = typeof input.shape === 'string' && IMAGE_SHAPES.has(input.shape) ? input.shape as SanitizedImageProps['shape'] : 'rectangle';
    const radius = clampNumber(input.radius, 0, 240, 8);
    const borderWidth = clampNumber(input.borderWidth, 0, 48, 0);
    const borderStyle = typeof input.borderStyle === 'string' && IMAGE_BORDER_STYLES.has(input.borderStyle) ? input.borderStyle as SanitizedImageProps['borderStyle'] : 'solid';
    const borderColor = typeof input.borderColor === 'string' && input.borderColor.trim() ? input.borderColor.trim() : '#000000';
    const scale = clampNumber(input.scale, 0.1, 4, 1);
    return { src, alt, fit, shape, radius, borderWidth, borderColor, borderStyle, scale };
}

function resolveAssetPath(value: string | undefined, assetsBase: string): string {
    if (!value) return '';
    if (isAssetScheme(value)) return path.posix.join(assetsBase, value.slice('asset://'.length));
    if (isLegacyAssetPath(value)) return path.posix.join(assetsBase, value.slice('assets/'.length));
    if (value.startsWith('asset://')) return path.posix.join(assetsBase, value.slice('asset://'.length));
    return value;
}

const GITHUB_LAYOUTS = new Set(['cards', 'list']);
const FALLBACK_GITHUB_USERNAME = 'snxethan';

type SanitizedRepoPreview = {
    id: string;
    name: string;
    description?: string;
    stars: number;
    url: string;
    language?: string;
    updatedAt?: string;
    updatedLabel?: string;
};

type SanitizedGitHubWidgetProps = {
    username: string;
    displayUsername: string;
    layout: 'cards' | 'list';
    repos: SanitizedRepoPreview[];
    cachedFetchedAt?: number;
    isSampleUser: boolean;
    ariaLabel?: string;
    ariaDescription?: string;
    statusText: string;
    containerBackgroundColor?: string;
    cardBackgroundColor?: string;
    cardTextColor?: string;
    cardMutedColor?: string;
    cardBorderColor?: string;
};

function clampRepoCountValue(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 6;
    const rounded = Math.round(value);
    if (rounded < 1) return 1;
    if (rounded > 30) return 30;
    return rounded;
}

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTimeFromMs(target: number, now = Date.now()): string {
    const diff = target - now;
    const minutes = Math.round(diff / 60000);
    if (Math.abs(minutes) < 60) return RELATIVE_FORMATTER.format(minutes, 'minute');
    const hours = Math.round(diff / 3600000);
    if (Math.abs(hours) < 24) return RELATIVE_FORMATTER.format(hours, 'hour');
    const days = Math.round(diff / 86400000);
    return RELATIVE_FORMATTER.format(days, 'day');
}

function formatRelativeFromIso(iso?: string): string | undefined {
    if (!iso) return undefined;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    try {
        return formatRelativeTimeFromMs(date.getTime());
    } catch {
        return undefined;
    }
}

function coerceColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function sanitizeGitHubWidgetProps(raw: any): SanitizedGitHubWidgetProps {
    const rawUsername = typeof raw?.username === 'string' ? raw.username.trim() : '';
    const isSampleUser = rawUsername.length === 0;
    const username = (rawUsername || FALLBACK_GITHUB_USERNAME).replace(/^@+/, '');
    const layout: 'cards' | 'list' = typeof raw?.layout === 'string' && GITHUB_LAYOUTS.has(raw.layout) ? raw.layout : 'cards';
    const maxItems = clampRepoCountValue(raw?.maxItems);
    const cachedFetchedAt = typeof raw?.cachedFetchedAt === 'number' && Number.isFinite(raw.cachedFetchedAt) ? raw.cachedFetchedAt : undefined;
    const ariaLabel = typeof raw?.ariaLabel === 'string' && raw.ariaLabel.trim() ? raw.ariaLabel.trim() : undefined;
    const ariaDescription = typeof raw?.ariaDescription === 'string' && raw.ariaDescription.trim() ? raw.ariaDescription.trim() : undefined;
    const containerBackgroundColor = coerceColor(raw?.containerBackgroundColor);
    const cardBackgroundColor = coerceColor(raw?.cardBackgroundColor);
    const cardTextColor = coerceColor(raw?.cardTextColor);
    const cardMutedColor = coerceColor(raw?.cardMutedColor);
    const cardBorderColor = coerceColor(raw?.cardBorderColor);
    const rawRepos = Array.isArray(raw?.cachedRepos) ? raw.cachedRepos : [];
    const repos = rawRepos
        .map((entry: any, idx: number): SanitizedRepoPreview | null => {
            const name = typeof entry?.name === 'string' && entry.name.trim() ? entry.name.trim() : null;
            const url = typeof entry?.url === 'string' && entry.url.trim() ? entry.url.trim() : null;
            if (!name || !url) return null;
            const id = typeof entry?.id === 'string' && entry.id.trim()
                ? entry.id.trim()
                : typeof entry?.id === 'number' && Number.isFinite(entry.id)
                    ? String(entry.id)
                    : `${username}-${idx}`;
            const description = typeof entry?.description === 'string' && entry.description.trim() ? entry.description.trim() : undefined;
            const stars = typeof entry?.stars === 'number' && Number.isFinite(entry.stars) ? Math.max(0, Math.round(entry.stars)) : 0;
            const language = typeof entry?.language === 'string' && entry.language.trim() ? entry.language.trim() : undefined;
            const updatedAt = typeof entry?.updatedAt === 'string' && entry.updatedAt.trim() ? entry.updatedAt : undefined;
            return { id, name, url, description, stars, language, updatedAt, updatedLabel: formatRelativeFromIso(updatedAt) };
        })
        .filter(Boolean)
        .slice(0, maxItems) as SanitizedRepoPreview[];

    let statusText = 'Repository data cached during export.';
    if (repos.length === 0) {
        statusText = isSampleUser
            ? 'Set your GitHub username in the editor to fetch repositories.'
            : 'No cached repositories were included in this export. Refresh the widget in the editor and rebuild.';
    } else if (cachedFetchedAt) {
        try {
            statusText = `Showing cached data from ${new Date(cachedFetchedAt).toLocaleString()}`;
        } catch { /* ignore */ }
    }

    return {
        username,
        displayUsername: `@${username}`,
        layout,
        repos,
        cachedFetchedAt,
        isSampleUser,
        ariaLabel,
        ariaDescription,
        statusText,
        containerBackgroundColor,
        cardBackgroundColor,
        cardTextColor,
        cardMutedColor,
        cardBorderColor,
    };
}

const CONTACT_LIVE_MODES = new Set(['off', 'polite', 'assertive']);
const CONTACT_SUBMIT_ACTIONS = new Set(['mailto', 'event']);

type SanitizedContactProps = {
    heading?: string;
    description?: string;
    ariaDescription?: string;
    nameLabel: string;
    emailLabel: string;
    messageLabel: string;
    submitLabel: string;
    requireName: boolean;
    requireEmail: boolean;
    requireMessage: boolean;
    submitAction: 'mailto' | 'event';
    mailtoTo: string;
    successText: string;
    errorText: string;
    fontFamily: string;
    fontSize?: number;
    liveMode: 'off' | 'polite' | 'assertive';
    cardBackgroundColor?: string;
};

function sanitizeContactProps(raw: any): SanitizedContactProps {
    const heading = typeof raw?.heading === 'string' && raw.heading.trim() ? raw.heading.trim() : 'Contact me';
    const description = typeof raw?.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined;
    const ariaDescription = typeof raw?.ariaDescription === 'string' && raw.ariaDescription.trim() ? raw.ariaDescription.trim() : undefined;
    const nameLabel = typeof raw?.nameLabel === 'string' && raw.nameLabel.trim() ? raw.nameLabel.trim() : 'Your name';
    const emailLabel = typeof raw?.emailLabel === 'string' && raw.emailLabel.trim() ? raw.emailLabel.trim() : 'Your email';
    const messageLabel = typeof raw?.messageLabel === 'string' && raw.messageLabel.trim() ? raw.messageLabel.trim() : 'Message';
    const submitLabel = typeof raw?.submitLabel === 'string' && raw.submitLabel.trim() ? raw.submitLabel.trim() : 'Send';
    const requireName = raw?.requireName === false ? false : true;
    const requireEmail = raw?.requireEmail === false ? false : true;
    const requireMessage = raw?.requireMessage === false ? false : true;
    const submitAction: 'mailto' | 'event' = CONTACT_SUBMIT_ACTIONS.has(raw?.submitAction) ? raw.submitAction : 'mailto';
    const mailtoTo = typeof raw?.mailtoTo === 'string' ? raw.mailtoTo.trim() : '';
    const successText = typeof raw?.successText === 'string' && raw.successText.trim() ? raw.successText.trim() : 'Thanks! Your message is ready to send.';
    const errorText = typeof raw?.errorText === 'string' && raw.errorText.trim() ? raw.errorText.trim() : 'Please fix the errors below.';
    const fontFamily = raw?.font === 'serif' ? FONT_STACK_SERIF : raw?.font === 'mono' ? FONT_STACK_MONO : FONT_STACK_SYSTEM;
    const fontSize = typeof raw?.fontSize === 'number' && !Number.isNaN(raw.fontSize)
        ? clampNumber(raw.fontSize, 8, 128, raw.fontSize)
        : undefined;
    const liveMode: 'off' | 'polite' | 'assertive' = CONTACT_LIVE_MODES.has(raw?.liveMode) ? raw.liveMode : 'polite';
    const cardBackgroundColor = coerceColor(raw?.cardBackgroundColor);
    return {
        heading,
        description,
        ariaDescription,
        nameLabel,
        emailLabel,
        messageLabel,
        submitLabel,
        requireName,
        requireEmail,
        requireMessage,
        submitAction,
        mailtoTo,
        successText,
        errorText,
        fontFamily,
        fontSize,
        liveMode,
        cardBackgroundColor,
    };
}

type VideoProvider = 'youtube' | 'file' | 'unknown';

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

function detectVideoProvider(src: string): VideoProvider {
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

export type ProjectPayload = {
    project: any;
    assets: Record<string, string>; // base64
    outputDir?: string;
    globalCss?: { tailwind?: string };
    themeCss?: string;
};

function escapeHtml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderWidgetToHtml(
    widget: any,
    assetsBase: string,
    placeholderUrl: string,
    pageFilenameMap?: Record<string, string>,
    collectCss?: (s: string) => void,
    themeColors?: WidgetThemeSnapshot,
    currentPageId?: string
) {
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
                const safe = sanitizeTextProps(props);
                const wrapperStyle: string[] = [`text-align:${safe.align}`, `font-family:${safe.fontFamily}`];
                if (safe.color) wrapperStyle.push(`color:${safe.color}`);
                if (typeof safe.fontSize === 'number') wrapperStyle.push(`font-size:${safe.fontSize}px`);
                if (safe.weight) wrapperStyle.push(`font-weight:${safe.weight === 'bold' ? 700 : 400}`);
                if (safe.italic) wrapperStyle.push('font-style:italic');
                const ariaBits: string[] = [];
                if (safe.ariaLabel) ariaBits.push(`aria-label="${escapeHtml(safe.ariaLabel)}"`);
                if (safe.ariaDescription) ariaBits.push(`aria-description="${escapeHtml(safe.ariaDescription)}"`);

                let inner = '';
                if (safe.variant === 'paragraph') {
                    if (safe.format === 'markdown') {
                        const html = renderMarkdownToHtml(safe.text);
                        inner = `<div class="prose prose-sm max-w-none">${html}</div>`;
                    } else {
                        inner = `<p>${escapeHtml(safe.text)}</p>`;
                    }
                } else {
                    const tag = safe.variant === 'h2' ? 'h2' : 'h3';
                    const headingWeight = safe.weight ? safe.weight : 'bold';
                    if (safe.text.trim().length > 0) {
                        inner = `<${tag} style="font-weight:${headingWeight === 'bold' ? 700 : 400}">${escapeHtml(safe.text)}</${tag}>`;
                    } else {
                        inner = `<p aria-hidden="true" style="font-weight:${headingWeight === 'bold' ? 700 : 400};color:transparent;user-select:none;">.</p>`;
                    }
                }

                const styleAttr = wrapperStyle.join(';');
                const ariaAttr = ariaBits.length ? ` ${ariaBits.join(' ')}` : '';
                return `<div class="widget widget-text widget-instance-${id}" style="${styleAttr}"${ariaAttr}>${inner}</div>`;
            }
            case 'image': {
                const safe = sanitizeImageProps(props);
                const resolved = safe.src ? resolveAssetPath(safe.src, assetsBase) : '';
                const finalSrc = resolved || placeholderUrl;
                const radius = safe.shape === 'circle' ? '50%' : (safe.shape === 'rounded' ? `${safe.radius}px` : '0px');
                const border = safe.borderWidth > 0 ? `${safe.borderWidth}px ${safe.borderStyle} ${safe.borderColor}` : null;
                const wrapperStyles = [
                    'width:100%', 'height:100%', 'overflow:hidden', 'box-sizing:border-box', `border-radius:${radius}`
                ];
                if (border) wrapperStyles.push(`border:${border}`);
                const imgStyles = ['width:100%', 'height:100%', 'display:block', 'object-fit:' + safe.fit, 'object-position:center center'];
                if (safe.scale !== 1) {
                    imgStyles.push(`transform:scale(${safe.scale})`, 'transform-origin:center center');
                }
                const imgHtml = safe.src
                    ? `<img src="${escapeHtml(finalSrc)}" alt="${escapeHtml(safe.alt)}" loading="lazy" decoding="async" style="${imgStyles.join(';')}" />`
                    : '';
                return `<div class="widget widget-image widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${imgHtml}</div></div>`;
            }
            case 'project': {
                const title = escapeHtml(String(props.title || 'Project'));
                const desc = escapeHtml(String(props.description || ''));
                let imgHtml = '';
                if (props.image) {
                    const imgSrc = props.image.startsWith('asset://') ? path.posix.join(assetsBase, props.image.slice('asset://'.length)) : props.image;
                    imgHtml = `<div class="proj-img"><img src="${imgSrc}" alt="${escapeHtml(props.imageAlt || '')}"/></div>`;
                }
                // project card styling (include per-instance font and size to mirror editor)
                // Determine font-family based on widget props (mirror renderer logic)
                const fontChoice = String(props.font || 'system');
                const fontFamily = fontChoice === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' : (fontChoice === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"');
                const sizeRule = (typeof props.fontSize === 'number') ? `font-size: ${props.fontSize}px;` : '';
                pushCss(`color: var(--widget-fg); font-family: ${fontFamily}; ${sizeRule}`);
                if (props.image) pushCss('.proj-img img { width:100%; height:260px; object-fit:cover; border-radius:8px; }');
                return `<article class="widget widget-project widget-instance-${id}">${imgHtml}<h3>${title}</h3><p>${desc}</p></article>`;
            }
            case 'contact': {
                const safe = sanitizeContactProps(props);
                const nameId = `${id}-contact-name`;
                const emailId = `${id}-contact-email`;
                const messageId = `${id}-contact-message`;
                const descId = safe.description || safe.ariaDescription ? `${id}-contact-desc` : undefined;
                const cardBackground = safe.cardBackgroundColor || 'var(--widget-bg,var(--surface,#fff))';
                const descriptionHtml = safe.description
                    ? `<p id="${descId}" class="contact-description">${escapeHtml(safe.description)}</p>`
                    : (safe.ariaDescription ? `<p id="${descId}" class="sr-only">${escapeHtml(safe.ariaDescription)}</p>` : '');
                const styleBits = [`font-family:${safe.fontFamily}`];
                if (typeof safe.fontSize === 'number') styleBits.push(`font-size:${safe.fontSize}px`);
                const formAttrs = [
                    'data-contact-widget="true"',
                    `data-submit-action="${safe.submitAction}"`,
                    `data-mailto-to="${escapeHtml(safe.mailtoTo)}"`,
                    `data-require-name="${safe.requireName}"`,
                    `data-require-email="${safe.requireEmail}"`,
                    `data-require-message="${safe.requireMessage}"`,
                    `data-success-text="${escapeHtml(safe.successText)}"`,
                    `data-error-text="${escapeHtml(safe.errorText)}"`,
                    `data-live-mode="${safe.liveMode}"`
                ].join(' ');
                const statusAttrs = safe.liveMode !== 'off' ? ` role="status" aria-live="${safe.liveMode}"` : '';
                pushCss(`.widget-instance-${id}.widget-contact{height:100%;width:100%;display:flex;min-height:0;}
.widget-instance-${id} .contact-card{width:100%;height:100%;display:flex;flex-direction:column;gap:12px;padding:20px;border:1px solid var(--border,#d1d5db);border-radius:18px;background:var(--contact-card-bg,var(--widget-bg,var(--surface,#fff)));min-height:0;overflow:hidden;}
.widget-instance-${id} .contact-heading{margin:0;font-size:18px;font-weight:600;color:var(--fg,#0f172a);}
.widget-instance-${id} .contact-description{font-size:13px;color:var(--fg-muted,#475569);margin:0;}
.widget-instance-${id} .contact-form{display:flex;flex-direction:column;gap:12px;width:100%;flex:1;min-height:0;overflow:auto;}
.widget-instance-${id} .contact-field label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--fg,#0f172a);}
.widget-instance-${id} .contact-field input,.widget-instance-${id} .contact-field textarea{width:100%;border:1px solid var(--border,#d1d5db);border-radius:10px;padding:10px;background:var(--surface,#fff);color:var(--fg,#0f172a);font:inherit;}
.widget-instance-${id} .contact-field textarea{min-height:96px;resize:vertical;}
.widget-instance-${id} .contact-error{font-size:11px;color:#dc2626;min-height:14px;}
.widget-instance-${id} .contact-actions{display:flex;justify-content:flex-start;}
.widget-instance-${id} .contact-actions button{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border-radius:999px;border:2px solid var(--border,#0f172a);background:var(--accent,#2563eb);color:var(--widget-fg,#ffffff);font-weight:600;font-size:14px;cursor:pointer;}
.widget-instance-${id} .contact-status{font-size:12px;color:var(--fg-muted,#475569);display:none;}`);
                const headingHtml = safe.heading ? `<h3 class="contact-heading">${escapeHtml(safe.heading)}</h3>` : '';
                const nameField = `<div class="contact-field"><label for="${nameId}">${escapeHtml(safe.nameLabel)}</label><input type="text" id="${nameId}" name="contact-name" autocomplete="name" ${safe.requireName ? 'required' : ''} aria-invalid="false" /><div class="contact-error" data-error="name"></div></div>`;
                const emailField = `<div class="contact-field"><label for="${emailId}">${escapeHtml(safe.emailLabel)}</label><input type="email" id="${emailId}" name="contact-email" autocomplete="email" ${safe.requireEmail ? 'required' : ''} aria-invalid="false" /><div class="contact-error" data-error="email"></div></div>`;
                const messageField = `<div class="contact-field"><label for="${messageId}">${escapeHtml(safe.messageLabel)}</label><textarea id="${messageId}" name="contact-message" ${safe.requireMessage ? 'required' : ''} aria-invalid="false"></textarea><div class="contact-error" data-error="message"></div></div>`;
                const form = `<form class="contact-form" ${descId ? `aria-describedby="${descId}" ` : ''}${formAttrs} style="${styleBits.join(';')}" novalidate>${nameField}${emailField}${messageField}<div class="contact-actions"><button type="submit">${escapeHtml(safe.submitLabel)}</button></div><div class="contact-status" data-contact-status=""${statusAttrs}></div></form>`;
                const cardStyleAttr = ` style="--contact-card-bg:${escapeHtml(cardBackground)};"`;
                return `<section class="widget widget-contact widget-instance-${id}"><div class="contact-card"${cardStyleAttr}>${headingHtml}${descriptionHtml}${form}</div></section>`;
            }
            case 'link': {
                const safe = sanitizeLinkProps(props);
                if (!safe.url) {
                    return `<div class="widget widget-link widget-instance-${id}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--fg-muted);font-size:12px;padding:16px;">Add a link URL to finish setup.</div></div>`;
                }
                const fontFamily = fontFamilyForChoice(safe.font, themeColors);
                const fontWeight = safe.weight === 'bold' ? 700 : 400;
                const fontStyle = safe.italic ? 'italic' : 'normal';
                const fontSize = `${safe.fontSize}px`;
                const accent = themeColors?.accent || 'var(--accent)';
                const borderColor = themeColors?.border || 'var(--border)';
                const surface = themeColors?.surface || 'var(--surface)';
                const textColor = themeColors?.text || 'var(--fg)';
                const buttonText = themeColors?.widgetText || '#ffffff';
                const href = escapeHtml(safe.url);
                const ariaBits: string[] = ['target="_blank"', 'rel="noopener noreferrer"'];
                const ariaLabel = safe.ariaLabel || safe.label;
                if (ariaLabel) ariaBits.push(`aria-label="${escapeHtml(ariaLabel)}"`);
                if (safe.ariaDescription) ariaBits.push(`aria-description="${escapeHtml(safe.ariaDescription)}"`);
                const iconLeft = safe.iconLeft ? `<span aria-hidden="true" style="margin-right:6px;">${escapeHtml(safe.iconLeft)}</span>` : '';
                const iconRight = safe.iconRight ? `<span aria-hidden="true" style="margin-left:6px;">${escapeHtml(safe.iconRight)}</span>` : '';
                const contentLabel = `<span>${escapeHtml(safe.label)}</span>`;

                if (safe.variant === 'text') {
                    const style = [
                        `color:${accent}`,
                        `font-weight:${fontWeight}`,
                        `text-decoration:underline`,
                        `font-size:${fontSize}`,
                        `display:inline-flex`,
                        `align-items:center`,
                        `font-family:${fontFamily}`,
                        `font-style:${fontStyle}`
                    ].join(';');
                    return `<div class="widget widget-link widget-instance-${id}"><a href="${href}" style="${style}" ${ariaBits.join(' ')}>${iconLeft}${contentLabel}${iconRight}</a></div>`;
                }

                if (safe.variant === 'card') {
                    const style = [
                        `display:flex`,
                        `width:100%`,
                        `height:100%`,
                        `flex-direction:column`,
                        `justify-content:center`,
                        `gap:6px`,
                        `padding:16px`,
                        `border-radius:16px`,
                        `border:1px solid ${borderColor}`,
                        `background:${surface}`,
                        `box-shadow:0 8px 20px rgba(0,0,0,0.06)`,
                        `text-decoration:none`,
                        `color:${textColor}`
                    ].join(';');
                    const sub = `<span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${accent};opacity:0.9">Link</span><div style="display:flex;align-items:center;font-size:${fontSize};font-weight:${fontWeight};font-style:${fontStyle};font-family:${fontFamily};color:${textColor}">${iconLeft}${contentLabel}${iconRight}</div>`;
                    return `<div class="widget widget-link widget-instance-${id}"><a href="${href}" style="${style}" ${ariaBits.join(' ')}>${sub}</a></div>`;
                }

                const btnStyle = [
                    `display:inline-flex`,
                    `align-items:center`,
                    `gap:8px`,
                    `padding:10px 16px`,
                    `border-radius:999px`,
                    `border:2px solid ${borderColor}`,
                    `box-shadow:2px 2px 0 rgba(0,0,0,0.06)`,
                    `background:${accent}`,
                    `color:${buttonText}`,
                    `text-decoration:none`,
                    `font-weight:${fontWeight}`,
                    `font-style:${fontStyle}`,
                    `font-size:${fontSize}`,
                    `font-family:${fontFamily}`
                ].join(';');
                return `<div class="widget widget-link widget-instance-${id}"><a href="${href}" style="${btnStyle}" ${ariaBits.join(' ')}>${iconLeft}${contentLabel}${iconRight}</a></div>`;
            }
            case 'nav-link': {
                const label = typeof props.label === 'string' && props.label.trim() ? props.label.trim() : 'Go to page';
                const align = props.align === 'center' ? 'center' : props.align === 'right' ? 'flex-end' : 'flex-start';
                const fontChoice: FontChoice = props.font === 'serif' ? 'serif' : props.font === 'mono' ? 'mono' : 'system';
                const fontFamily = fontFamilyForChoice(fontChoice, themeColors);
                const fontSize = typeof props.fontSize === 'number' && !Number.isNaN(props.fontSize) ? clamp(props.fontSize, 8, 128) : undefined;
                const wrapperStyle = `width:100%;height:100%;display:flex;align-items:center;justify-content:${align};`;
                const targetId = typeof props.targetPageId === 'string' ? props.targetPageId : '';
                const href = targetId && pageFilenameMap && pageFilenameMap[targetId] ? pageFilenameMap[targetId] : '';
                if (!href) {
                    return `<div class="widget widget-nav-link widget-instance-${id}" style="${wrapperStyle}"><span role="link" aria-disabled="true" style="opacity:0.6;font-size:12px;color:${themeColors?.muted || 'var(--fg-muted)'};">${escapeHtml(label)}</span></div>`;
                }
                const isButton = props.style === 'button';
                const ariaLabel = typeof props.ariaLabel === 'string' && props.ariaLabel.trim() ? props.ariaLabel.trim() : label;
                const ariaBits = [`aria-label="${escapeHtml(ariaLabel)}"`, `title="${escapeHtml(label)}"`];
                const ariaCurrent = currentPageId && targetId === currentPageId ? 'page' : undefined;
                if (ariaCurrent) ariaBits.push('aria-current="page"');
                const fontSizeRule = fontSize ? `${fontSize}px` : isButton ? '12px' : '14px';

                if (isButton) {
                    const bg = typeof props.color === 'string' && props.color.trim() ? props.color.trim() : (themeColors?.accent || '#2563eb');
                    const textColor = typeof props.textColor === 'string' && props.textColor.trim() ? props.textColor.trim() : (themeColors?.widgetText || '#ffffff');
                    const border = themeColors?.border || '#0f172a';
                    const style = [
                        `display:inline-block`,
                        `padding:6px 10px`,
                        `border-radius:8px`,
                        `background:${bg}`,
                        `color:${textColor}`,
                        `text-decoration:none`,
                        `font-size:${fontSizeRule}`,
                        `font-weight:600`,
                        `border:2px solid ${border}`,
                        `box-shadow:1px 1px 0 rgba(0,0,0,0.12)`,
                        `font-family:${fontFamily}`
                    ].join(';');
                    return `<div class="widget widget-nav-link widget-instance-${id}" style="${wrapperStyle}"><a href="${escapeHtml(href)}" style="${style}" ${ariaBits.join(' ')}>${escapeHtml(label)}</a></div>`;
                }

                const color = typeof props.color === 'string' && props.color.trim() ? props.color.trim() : (themeColors?.accent || '#2563eb');
                const underline = props.underline ? 'underline' : 'none';
                const decoration = ariaCurrent ? 'underline' : underline;
                const style = [
                    `color:${color}`,
                    `text-decoration:${decoration}`,
                    `font-size:${fontSizeRule}`,
                    `font-weight:600`,
                    `font-family:${fontFamily}`
                ].join(';');
                return `<div class="widget widget-nav-link widget-instance-${id}" style="${wrapperStyle}"><a href="${escapeHtml(href)}" style="${style}" ${ariaBits.join(' ')}>${escapeHtml(label)}</a></div>`;
            }
            case 'video': {
                const safe = sanitizeVideoProps(props);
                const radius = safe.shape === 'circle' ? '999px' : (safe.shape === 'rounded' ? `${safe.borderRadius ?? 12}px` : `${safe.borderRadius ?? 0}px`);
                const border = safe.borderWidth && safe.borderWidth > 0
                    ? `${safe.borderWidth}px ${safe.borderStyle || 'solid'} ${safe.borderColor || 'var(--border)'}`
                    : '1px solid var(--border)';
                const wrapperStyles = [
                    'width:100%', 'height:100%', 'overflow:hidden', 'box-sizing:border-box', 'position:relative',
                    `border-radius:${radius}`,
                    `background:${safe.backgroundColor || 'var(--surface)'}`,
                    `border:${border}`
                ];
                const placeholder = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;color:var(--fg-muted);font-size:12px;">${escapeHtml(safe.fallbackText || VIDEO_BASE_FALLBACK)}</div>`;
                if (!safe.src) {
                    return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${placeholder}</div></div>`;
                }
                const provider = detectVideoProvider(safe.src);
                const shouldAutoplay = Boolean(safe.autoplay);
                const shouldMute = shouldAutoplay ? true : safe.muted !== false;
                const showControls = safe.controls !== false;
                const playsInline = safe.playsInline !== false;
                if (provider === 'youtube') {
                    const idPart = extractYouTubeId(safe.src);
                    if (!idPart) {
                        return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${placeholder}</div></div>`;
                    }
                    const embedUrl = buildYouTubeEmbedUrl(idPart, { autoplay: shouldAutoplay, muted: shouldMute, controls: showControls, loop: Boolean(safe.loop), playsInline });
                    const allowFullscreenAttr = safe.allowFullscreen === false ? '' : ' allowfullscreen';
                    const iframe = `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(safe.title || 'Embedded video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" style="width:100%;height:100%;border:0;display:block;background:#000" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"${allowFullscreenAttr}></iframe>`;
                    return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${iframe}</div></div>`;
                }
                if (provider === 'file') {
                    const resolvedSrc = resolveAssetPath(safe.src, assetsBase) || safe.src;
                    if (!resolvedSrc) {
                        return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${placeholder}</div></div>`;
                    }
                    const resolvedPoster = safe.poster ? resolveAssetPath(safe.poster, assetsBase) : '';
                    const attrs: string[] = [
                        `src="${escapeHtml(resolvedSrc)}"`,
                        `style="width:100%;height:100%;object-fit:cover;display:block;background:#000"`
                    ];
                    if (showControls) attrs.push('controls');
                    if (shouldAutoplay) attrs.push('autoplay');
                    if (shouldMute) attrs.push('muted');
                    if (safe.loop) attrs.push('loop');
                    if (playsInline) attrs.push('playsinline');
                    if (safe.title) attrs.push(`title="${escapeHtml(safe.title)}"`);
                    if (resolvedPoster) attrs.push(`poster="${escapeHtml(resolvedPoster)}"`);
                    const videoEl = `<video ${attrs.join(' ')}>Your browser does not support embedded video.</video>`;
                    return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${videoEl}</div></div>`;
                }
                return `<div class="widget widget-video widget-instance-${id}"><div style="${wrapperStyles.join(';')}">${placeholder}</div></div>`;
            }
            case 'github-repos': {
                const safe = sanitizeGitHubWidgetProps(props);
                const descId = safe.ariaDescription ? `${id}-github-desc` : undefined;
                const layoutClass = safe.layout === 'cards' ? 'gh-layout-cards' : 'gh-layout-list';
                const repoList = safe.repos.length ? safe.repos.map(repo => {
                    const desc = repo.description ? `<p class="gh-desc">${escapeHtml(repo.description)}</p>` : '';
                    const metaBits: string[] = [];
                    if (repo.language) metaBits.push(escapeHtml(repo.language));
                    if (repo.updatedLabel) metaBits.push(`Updated ${escapeHtml(repo.updatedLabel)}`);
                    const meta = metaBits.length ? `<div class="gh-meta">${metaBits.join(' • ')}</div>` : '';
                    return `<a class="gh-card" href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer"><div class="gh-card-head"><h3>${escapeHtml(repo.name)}</h3><span class="gh-stars">★ ${repo.stars}</span></div>${desc}${meta}</a>`;
                }).join('') : `<div class="gh-placeholder">${escapeHtml(safe.statusText)}</div>`;
                const footerMeta = safe.cachedFetchedAt ? (() => {
                    try { return `<span>${escapeHtml(new Date(safe.cachedFetchedAt).toLocaleString())}</span>`; } catch { return ''; }
                })() : '';
                const containerBackground = safe.containerBackgroundColor || 'var(--widget-bg,var(--surface,#fff))';
                const cardBackground = safe.cardBackgroundColor || 'var(--surface,#fff)';
                const cardBorder = safe.cardBorderColor || 'var(--border,#d1d5db)';
                const cardText = safe.cardTextColor || 'var(--fg,#0f172a)';
                const cardMuted = safe.cardMutedColor || 'var(--fg-muted,#475569)';
                pushCss(`.widget-instance-${id}.widget-github-repos{display:flex;flex-direction:column;gap:14px;padding:18px;border:1px solid var(--border,#d1d5db);border-radius:18px;background:${containerBackground};height:100%;--gh-card-bg:${cardBackground};--gh-card-border:${cardBorder};--gh-card-text:${cardText};--gh-card-muted:${cardMuted};}
.widget-instance-${id} .gh-header{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.widget-instance-${id} .gh-username{font-size:18px;font-weight:600;color:var(--fg,#0f172a);}
.widget-instance-${id} .gh-subtitle{font-size:12px;color:var(--fg-muted,#475569);margin:0;}
.widget-instance-${id} .gh-list{flex:1;min-height:0;overflow:auto;}
.widget-instance-${id} .gh-layout-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;}
.widget-instance-${id} .gh-layout-list{display:flex;flex-direction:column;gap:12px;}
    .widget-instance-${id} .gh-card{border:1px solid var(--gh-card-border,var(--border,#d1d5db));border-radius:16px;padding:16px;text-decoration:none;color:var(--gh-card-text,var(--fg,#0f172a));background:var(--gh-card-bg,var(--surface,#fff));box-shadow:0 6px 18px rgba(15,23,42,0.08);transition:transform 0.2s ease, box-shadow 0.2s ease;display:flex;flex-direction:column;gap:8px;}
.widget-instance-${id} .gh-card:hover{transform:translateY(-2px);box-shadow:0 18px 30px rgba(15,23,42,0.12);}
.widget-instance-${id} .gh-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.widget-instance-${id} .gh-card-head h3{margin:0;font-size:16px;}
.widget-instance-${id} .gh-stars{font-size:12px;border-radius:999px;padding:2px 8px;border:1px solid rgba(37,99,235,0.3);background:rgba(37,99,235,0.12);color:#0f172a;}
    .widget-instance-${id} .gh-desc{margin:0;font-size:13px;color:var(--gh-card-muted,var(--fg-muted,#475569));}
    .widget-instance-${id} .gh-meta{font-size:12px;color:var(--gh-card-muted,var(--fg-muted,#475569));display:flex;gap:8px;flex-wrap:wrap;}
    .widget-instance-${id} .gh-placeholder{border:1px dashed var(--border,#d1d5db);border-radius:14px;padding:24px;text-align:center;font-size:13px;color:var(--gh-card-muted,var(--fg-muted,#475569));}
    .widget-instance-${id} .gh-status{font-size:11px;color:var(--gh-card-muted,var(--fg-muted,#475569));display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}`);
                const descriptionHtml = safe.ariaDescription ? `<p id="${descId}" class="sr-only">${escapeHtml(safe.ariaDescription)}</p>` : '';
                const subtitle = safe.isSampleUser ? 'Sample profile shown until you set a username.' : 'Latest public repositories';
                return `<section class="widget widget-github-repos widget-instance-${id}" role="region" aria-label="${escapeHtml(safe.ariaLabel || 'GitHub repositories')}"${descId ? ` aria-describedby="${descId}"` : ''}>${descriptionHtml}<header class="gh-header"><div><div class="gh-username">${escapeHtml(safe.displayUsername)}</div><p class="gh-subtitle">${escapeHtml(subtitle)}</p></div></header><div class="gh-list ${layoutClass}">${repoList}</div><footer class="gh-status"><span>${escapeHtml(safe.statusText)}</span>${footerMeta}</footer></section>`;
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

function projectThemeToSnapshot(project: any): WidgetThemeSnapshot {
    const theme = (project && project.themes && project.themes[project.activeThemeId]) || null;
    const colors = (theme && theme.colors) || {};
    const typography = (theme && theme.typography) || {};
    return {
        text: colors.text || FALLBACK_WIDGET_THEME.text,
        muted: colors.muted || FALLBACK_WIDGET_THEME.muted,
        accent: colors.accent || FALLBACK_WIDGET_THEME.accent,
        primary: colors.primary || FALLBACK_WIDGET_THEME.primary,
        secondary: colors.secondary || FALLBACK_WIDGET_THEME.secondary,
        border: colors.border || FALLBACK_WIDGET_THEME.border,
        background: colors.background || FALLBACK_WIDGET_THEME.background,
        surface: colors.surface || FALLBACK_WIDGET_THEME.surface,
        widgetBackground: colors.widgetBackground || colors.surface || FALLBACK_WIDGET_THEME.widgetBackground,
        widgetText: colors.widgetText || colors.text || FALLBACK_WIDGET_THEME.widgetText,
        headingFont: typography.heading || FALLBACK_WIDGET_THEME.headingFont,
        bodyFont: typography.body || FALLBACK_WIDGET_THEME.bodyFont,
        fontScale: typeof typography.scale === 'number' ? typography.scale : FALLBACK_WIDGET_THEME.fontScale,
    };
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
        const themeSnapshot = projectThemeToSnapshot(project);
        const providedThemeCss = typeof payload.themeCss === 'string' ? payload.themeCss.trim() : '';
        const themeCss = providedThemeCss.length > 0 ? providedThemeCss : themeSnapshotToCss(themeSnapshot);
        const tailwindSnapshot = (payload.globalCss?.tailwind || '').trim();

        const baseCss = [
            '*{box-sizing:border-box}',
            'html,body{min-height:100%;background:var(--bg,#0f172a)}',
            "body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Inter,sans-serif;color:var(--fg,#0f172a)}",
            'main{min-height:100vh;background:inherit}',
            '.container{max-width:1100px;margin:0 auto;padding:36px}',
            '.page-canvas{position:relative;margin:0 auto;width:100%;background:inherit}',
            '.page-widget-wrapper{position:absolute;will-change:transform}',
            '.widget{width:100%;height:100%;display:block}',
            '.widget img,.widget video{max-width:100%;max-height:100%;display:block}',
            ".widget-unknown,.widget-error{font-family:monospace;background:transparent;border:1px dashed var(--border,#d1d5db);padding:12px;border-radius:6px;white-space:pre-wrap}",
            '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
        ].join('\n');

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
            const base = slugify(raw) || String(pid).slice(0, 8);
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

                const inner = renderWidgetToHtml(
                    w,
                    assetsBase,
                    path.posix.join(assetsBase, placeholderName),
                    pageFilenameMap,
                    (s: string) => collectedCss.push(s),
                    themeSnapshot,
                    pid
                );
                return `<div class="page-widget-wrapper" style="position:absolute;left:${left}px;top:${top}px;width:${wPx}px;height:${hPx}px;z-index:${z};">${inner}</div>`;
            }).join('\n');

            const title = escapeHtml(String(pg.title || project.portfolioMeta?.siteTitle || 'Portfolio'));
            const pageBackground = typeof pg.backgroundColor === 'string' && pg.backgroundColor.trim().length > 0
                ? pg.backgroundColor.trim()
                : null;
            const themeBackground = themeSnapshot.background || '#0f172a';
            const effectiveBackground = pageBackground || themeBackground;
            const htmlStyle = ` style="background:${effectiveBackground};"`;
            const bodyStyle = ` style="background:${effectiveBackground};"`;
            const mainStyle = ` style="min-height:100vh;${pageBackground ? `background:${pageBackground};` : 'background:inherit;'}"`;
            const canvasStyle = `position:relative;height:${height}px;max-width:${innerWidth}px;margin:0 auto;${pageBackground ? `background:${pageBackground};` : ''}`;
            const html = `<!doctype html>\n<html lang="en"${htmlStyle}>\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width,initial-scale=1" />\n  <title>${title}</title>\n  <link rel="stylesheet" href="./assets/tailwind.css" />\n  <link rel="stylesheet" href="./assets/theme.css" />\n  <link rel="stylesheet" href="./site.css" />\n</head>\n<body${bodyStyle}>\n  <main${mainStyle}>\n    <div class="container">\n      <div class="page-canvas" style="${canvasStyle}">\n        ${widgetBodies}\n      </div>\n    </div>\n  </main>\n  <script src="./site.js"></script>\n</body>\n</html>`;

            // Use slugified filename
            await fs.writeFile(path.join(out, pageFilenameMap[pid]), html, 'utf8');
        }

        // After building all pages, write aggregated CSS (base + collected widget CSS)
        const finalCss = [baseCss, ...collectedCss].join('\n\n');
        await fs.writeFile(path.join(out, 'site.css'), finalCss, 'utf8');

        // Emit theme + tailwind css assets
        await fs.writeFile(path.join(assetsOut, 'theme.css'), themeCss, 'utf8');
        const tailwindOut = tailwindSnapshot.length > 0 ? tailwindSnapshot : '/* Tailwind snapshot unavailable */\n';
        await fs.writeFile(path.join(assetsOut, 'tailwind.css'), tailwindOut, 'utf8');

        // Copy first page to index.html for root
        if (pages.length > 0) {
            const first = pages[0];
            const firstPath = path.join(out, pageFilenameMap[first]);
            if (fsSync.existsSync(firstPath)) {
                await fs.copyFile(firstPath, path.join(out, 'index.html'));
            }
        }

        // Add a small site JS to enable basic interactive widgets (carousel)
        const siteJs = `document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('.widget-carousel').forEach(function(car){
        const slides=Array.from(car.querySelectorAll('.slide'));
        if(slides.length<=1)return;
        let idx=0;
        slides.forEach(function(s,i){s.style.display=(i===0?'block':'none');});
        setInterval(function(){slides[idx].style.display='none';idx=(idx+1)%slides.length;slides[idx].style.display='block';},3500);
    });
    const emailPattern=/^.+@.+[.].+$/;
    document.querySelectorAll('.widget-contact form[data-contact-widget]').forEach(function(form){
        const nameInput=form.querySelector('input[name="contact-name"]');
        const emailInput=form.querySelector('input[name="contact-email"]');
        const messageInput=form.querySelector('textarea[name="contact-message"]');
        const statusEl=form.querySelector('[data-contact-status]');
        const setError=function(field,message){
            let input=null;
            if(field==='name') input=nameInput;
            else if(field==='email') input=emailInput;
            else if(field==='message') input=messageInput;
            const errorEl=form.querySelector('[data-error="'+field+'"]');
            if(input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
            if(errorEl){
                errorEl.textContent=message||'';
                errorEl.style.display=message?'block':'none';
            }
        };
        ['name','email','message'].forEach(function(field){
            const el=field==='name'?nameInput:field==='email'?emailInput:messageInput;
            if(!el) return;
            el.addEventListener('input',function(){ setError(field,''); if(statusEl && statusEl.dataset.state==='error'){ statusEl.textContent=''; statusEl.dataset.state=''; statusEl.style.display='none'; } });
        });
        form.addEventListener('submit',function(ev){
            ev.preventDefault();
            const data=form.dataset||{};
            const requireName=data.requireName==='true';
            const requireEmail=data.requireEmail==='true';
            const requireMessage=data.requireMessage==='true';
            const action=data.submitAction==='event'?'event':'mailto';
            const mailtoTo=data.mailtoTo||'';
            const successText=data.successText||'Thanks! Your message is ready to send.';
            const errorText=data.errorText||'Please fix the errors below.';
            const name=(nameInput && nameInput.value || '').trim();
            const email=(emailInput && emailInput.value || '').trim();
            const message=(messageInput && messageInput.value || '').trim();
            const errors={};
            if(requireName && !name) errors.name='Name is required';
            if(requireEmail){
                if(!email) errors.email='Email is required';
                else if(!emailPattern.test(email)) errors.email='Enter a valid email';
            } else if(email && !emailPattern.test(email)) {
                errors.email='Enter a valid email';
            }
            if(requireMessage && !message) errors.message='Message is required';
            ['name','email','message'].forEach(function(field){ setError(field, errors[field] || ''); });
            if(Object.keys(errors).length){
                if(statusEl){ statusEl.textContent=errorText; statusEl.dataset.state='error'; statusEl.style.display='block'; }
                if(errors.name && nameInput) nameInput.focus();
                else if(errors.email && emailInput) emailInput.focus();
                else if(errors.message && messageInput) messageInput.focus();
                return;
            }
            if(action==='event'){
                try { window.dispatchEvent(new CustomEvent('py:contactSubmit',{ detail:{ name:name, email:email, message:message }})); } catch {}
            } else {
                if(!mailtoTo){
                    if(statusEl){ statusEl.textContent='Contact email not configured.'; statusEl.dataset.state='error'; statusEl.style.display='block'; }
                    return;
                }
                const subject=encodeURIComponent('Contact from '+(name||'visitor'));
                const body=encodeURIComponent('Name: '+(name||'N/A')+'\nEmail: '+(email||'N/A')+'\n\n'+message);
                const href='mailto:'+mailtoTo+'?subject='+subject+'&body='+body;
                try { window.open(href,'_blank'); } catch { window.location.href=href; }
            }
            if(statusEl){ statusEl.textContent=successText; statusEl.dataset.state='success'; statusEl.style.display='block'; }
            form.reset();
            ['name','email','message'].forEach(function(field){ setError(field,''); });
        });
    });
});`;
        await fs.writeFile(path.join(out, 'site.js'), siteJs, 'utf8');

        return { ok: true, path: out };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}
