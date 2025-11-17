import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';

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
};

const defaultLinkProps: LinkWidgetProps = {
    url: 'https://example.com',
    label: 'Visit site',
    variant: 'button',
    font: 'system',
    fontSize: 16,
    weight: 'bold',
    italic: false,
};

const FONT_STACKS: Record<FontChoice, string> = {
    system: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

function sanitizeUrl(value?: string): string {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch {
        try {
            const attempt = new URL(`https://${trimmed}`);
            if (attempt.protocol === 'http:' || attempt.protocol === 'https:') return attempt.toString();
        } catch {
            return '';
        }
    }
    return '';
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
    return { url, label, variant, iconLeft, iconRight, font, fontSize, weight, italic };
}

function Placeholder() {
    return (
        <div className="w-full h-full flex items-center justify-center text-[color:var(--fg-muted)] text-xs text-center px-4">
            <span>Add a link URL to finish setup.</span>
        </div>
    );
}

function LinkView(props: LinkWidgetProps) {
    const safe = sanitizeProps(props);
    if (!safe.url) {
        return <Placeholder />;
    }
    const fontFamily = FONT_STACKS[safe.font || 'system'];
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
        'aria-label': safe.label,
    };

    if (safe.variant === 'text') {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <a
                    {...baseLinkProps}
                    style={{
                        color: 'var(--accent, #2563eb)',
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
                    border: '1px solid var(--border, #e5e7eb)',
                    background: 'var(--surface, #ffffff)',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                    textDecoration: 'none',
                    color: 'var(--fg, #0f172a)',
                }}
            >
                <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 }}>Link</span>
                <div style={{ display: 'flex', alignItems: 'center', fontSize, fontWeight, fontFamily, fontStyle }}>
                    {iconLeft}
                    <span>{safe.label}</span>
                    {iconRight}
                </div>
            </a>
        );
    }

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
                    border: '2px solid #000',
                    boxShadow: '2px 2px 0 #000',
                    background: 'var(--accent, #111827)',
                    color: '#fff',
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
    defaultProps: defaultLinkProps,
    grid: { w: 3, h: 2 },
    render: (props) => <LinkView {...props} />,
    zodSchema: z.object({
        url: z.string().min(1, 'URL is required').transform((value) => sanitizeUrl(value)).refine((value) => Boolean(value), {
            message: 'Enter a valid https:// link',
        }),
        label: z.string().min(1, 'Label is required').max(80, 'Label is too long'),
        variant: z.enum(['text', 'button', 'card']).optional(),
        iconLeft: z.string().max(24).optional().transform((value) => (value?.trim() ? value.trim().slice(0, 24) : undefined)),
        iconRight: z.string().max(24).optional().transform((value) => (value?.trim() ? value.trim().slice(0, 24) : undefined)),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
        weight: z.enum(['normal', 'bold']).optional(),
        italic: z.boolean().optional(),
    }),
};

export default def;
