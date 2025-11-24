import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { normalizeExternalLinkUrl } from '../utils/linkUrl';
import { useWidgetTheme } from '../sdk';

type LinkVariant = 'text' | 'button' | 'card';
type FontChoice = 'system' | 'serif' | 'mono';
type TextWeight = 'normal' | 'bold';

type LinkWidgetProps = {
    url: string;
    label: string;
    variant?: LinkVariant;
    iconLeft?: string;
    iconRight?: string;
    font?: FontChoice;
    fontSize?: number;
    weight?: TextWeight;
    italic?: boolean;
    ariaLabel?: string;
    ariaDescription?: string;
};

const defaultLinkProps: LinkWidgetProps = {
    url: 'https://example.com',
    label: 'Visit site',
    variant: 'button',
    font: 'system',
    fontSize: 16,
    weight: 'bold',
    italic: false,
    ariaLabel: undefined,
    ariaDescription: undefined,
};

const FONT_STACKS: Record<FontChoice, string> = {
    system: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

function sanitizeUrl(value?: string): string {
    return normalizeExternalLinkUrl(value);
}

function sanitizeIcon(value?: string): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, 24);
}

function sanitizeVariant(value?: string): LinkVariant {
    if (value === 'text' || value === 'button' || value === 'card') return value;
    return defaultLinkProps.variant || 'button';
}

function sanitizeFont(value?: string): FontChoice {
    if (value === 'serif' || value === 'mono' || value === 'system') return value;
    return defaultLinkProps.font || 'system';
}

function sanitizeFontSize(value?: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return defaultLinkProps.fontSize || 16;
    return Math.min(128, Math.max(8, value));
}

function sanitizeWeight(value?: string): TextWeight {
    if (value === 'bold' || value === 'normal') return value;
    return defaultLinkProps.weight || 'normal';
}

function sanitizeBool(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

function sanitizeProps(raw: LinkWidgetProps): LinkWidgetProps {
    const url = sanitizeUrl(raw.url);
    const label = (raw.label || '').trim() || defaultLinkProps.label;
    const variant = sanitizeVariant(raw.variant);
    const iconLeft = sanitizeIcon(raw.iconLeft);
    const iconRight = sanitizeIcon(raw.iconRight);
    const font = sanitizeFont(raw.font);
    const fontSize = sanitizeFontSize(raw.fontSize);
    const weight = sanitizeWeight(raw.weight);
    const italic = sanitizeBool(raw.italic, defaultLinkProps.italic);
    const ariaLabel = (raw.ariaLabel || '').trim() || undefined;
    const ariaDescription = (raw.ariaDescription || '').trim() || undefined;
    return { url, label, variant, iconLeft, iconRight, font, fontSize, weight, italic, ariaLabel, ariaDescription };
}

function Placeholder() {
    return (
        <div className="w-full h-full flex items-center justify-center text-[color:var(--fg-muted)] text-xs text-center px-4">
            <span>Add a link URL to finish setup.</span>
        </div>
    );
}

function LinkView(props: LinkWidgetProps) {
    const theme = useWidgetTheme();
    const safe = sanitizeProps(props);
    if (!safe.url) {
        return <Placeholder />;
    }
    const fontFamily = safe.font === 'serif'
        ? FONT_STACKS.serif
        : safe.font === 'mono'
            ? FONT_STACKS.mono
            : theme.bodyFont || FONT_STACKS.system;
    const fontWeight = safe.weight === 'bold' ? 700 : 400;
    const fontStyle = safe.italic ? 'italic' : 'normal';
    const fontSize = safe.fontSize || 16;
    const iconLeft = safe.iconLeft ? (
        <span aria-hidden="true" style={{ marginRight: 6 }}>
            {safe.iconLeft}
        </span>
    ) : null;
    const iconRight = safe.iconRight ? (
        <span aria-hidden="true" style={{ marginLeft: 6 }}>
            {safe.iconRight}
        </span>
    ) : null;

    const baseLinkProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
        href: safe.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: safe.label,
        'aria-label': safe.ariaLabel || safe.label,
        'aria-description': safe.ariaDescription,
    };

    if (safe.variant === 'text') {
        const linkColor = theme.accent || 'var(--accent, #2563eb)';
        return (
            <div className="w-full h-full flex items-center justify-center">
                <a
                    {...baseLinkProps}
                    style={{
                        color: linkColor,
                        fontWeight,
                        textDecoration: 'underline',
                        fontSize,
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontFamily,
                        fontStyle,
                    }}
                >
                    {iconLeft}
                    <span>{safe.label}</span>
                    {iconRight}
                </a>
            </div>
        );
    }

    if (safe.variant === 'card') {
        const borderColor = theme.border || 'var(--border, #e5e7eb)';
        const surface = theme.surface || 'var(--surface, #ffffff)';
        const textColor = theme.text || 'var(--fg, #0f172a)';
        const accent = theme.accent || 'var(--accent, #2563eb)';
        return (
            <a
                {...baseLinkProps}
                style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 16,
                    borderRadius: 16,
                    border: `1px solid ${borderColor}`,
                    background: surface,
                    boxShadow: `0 8px 20px color-mix(in srgb, ${borderColor} 35%, transparent)`,
                    textDecoration: 'none',
                    color: textColor,
                }}
            >
                <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: accent, opacity: 0.9 }}>Link</span>
                <div style={{ display: 'flex', alignItems: 'center', fontSize, fontWeight, fontFamily, fontStyle, color: textColor }}>
                    {iconLeft}
                    <span>{safe.label}</span>
                    {iconRight}
                </div>
            </a>
        );
    }

    const borderColor = theme.border || '#0f172a';
    const buttonBg = theme.accent || 'var(--accent, #111827)';
    const buttonText = theme.widgetText || '#ffffff';
    return (
        <div className="w-full h-full flex items-center justify-center">
            <a
                {...baseLinkProps}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 999,
                    border: `2px solid ${borderColor}`,
                    boxShadow: `2px 2px 0 color-mix(in srgb, ${borderColor} 70%, transparent)`,
                    background: buttonBg,
                    color: buttonText,
                    textDecoration: 'none',
                    fontWeight,
                    fontFamily,
                    fontStyle,
                    fontSize,
                }}
            >
                {iconLeft}
                <span>{safe.label}</span>
                {iconRight}
            </a>
        </div>
    );
}

const def: WidgetDefinition<LinkWidgetProps> = {
    type: 'link',
    label: 'Link',
    version: 1,
    defaultProps: defaultLinkProps,
    grid: { w: 3, h: 2 },
    render: (props) => <LinkView {...props} />,
    zodSchema: z.object({
        url: z.string().min(1, 'URL is required').transform((value) => sanitizeUrl(value)).refine((value) => Boolean(value), {
            message: 'Enter a valid http(s) link',
        }),
        label: z.string().min(1, 'Label is required').max(80, 'Label is too long'),
        variant: z.enum(['text', 'button', 'card']).optional(),
        iconLeft: z.string().max(24).optional().transform((value) => (value?.trim() ? value.trim().slice(0, 24) : undefined)),
        iconRight: z.string().max(24).optional().transform((value) => (value?.trim() ? value.trim().slice(0, 24) : undefined)),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
        weight: z.enum(['normal', 'bold']).optional(),
        italic: z.boolean().optional(),
        ariaLabel: z.string().max(120).optional(),
        ariaDescription: z.string().max(300).optional(),
    }),
};

export default def;
