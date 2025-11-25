import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { useWidget, useWidgetTheme } from '../sdk';

function NavLinkView(props: NavLinkProps) {
    const { currentPageId } = useWidget();
    const theme = useWidgetTheme();
    const href = props.targetPageId ? `#/page/${props.targetPageId}` : '';
    const isButton = props.style === 'button';
    const isCurrent = currentPageId && props.targetPageId === currentPageId;

    const wrapperStyle: React.CSSProperties = {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent:
            props.align === 'center' ? 'center' : props.align === 'right' ? 'flex-end' : 'flex-start',
    };
    const ff = props.font === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
        : props.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : theme.bodyFont || 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

    if (!href) {
        return (
            <div style={wrapperStyle}>
                <span role="link" aria-disabled="true" title={props.label} style={{ opacity: 0.6, fontSize: 12, color: theme.muted }}>
                    {props.label}
                </span>
            </div>
        );
    }

    if (isButton) {
        const bg = props.color || theme.accent || '#2563eb';
        const text = props.textColor || theme.widgetText || '#ffffff';
        const border = theme.border || '#0f172a';
        return (
            <div style={wrapperStyle}>
                <a
                    href={href}
                    aria-label={props.ariaLabel || props.label}
                    aria-current={isCurrent ? 'page' : undefined}
                    title={props.label}
                    style={{
                        display: 'inline-block',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: bg,
                        color: text,
                        textDecoration: 'none',
                        fontSize: props.fontSize ? `${props.fontSize}px` : 12,
                        fontWeight: 600,
                        border: `2px solid ${border}`,
                        boxShadow: `1px 1px 0 color-mix(in srgb, ${border} 70%, transparent)`,
                        fontFamily: ff,
                    }}
                >
                    {props.label}
                </a>
            </div>
        );
    }

    const color = props.color || theme.accent || '#2563eb';
    const textDecoration = props.underline ? 'underline' : 'none';
    return (
        <div style={wrapperStyle}>
            <a
                href={href}
                aria-label={props.ariaLabel || props.label}
                aria-current={isCurrent ? 'page' : undefined}
                title={props.label}
                style={{
                    color,
                    textDecoration: textDecoration === 'underline' || isCurrent ? 'underline' : 'none',
                    fontSize: props.fontSize ? `${props.fontSize}px` : 14,
                    fontWeight: 600,
                    fontFamily: ff,
                }}
            >
                {props.label}
            </a>
        </div>
    );
}

// Simple navigation link widget: renders an anchor that points to a page hash.
// v1: targets a page by ID; deployed site should interpret hash for routing.
// Example href pattern: #/page/<pageId>

type NavLinkProps = {
    label: string;
    targetPageId: string;
    style?: 'link' | 'button';
    align?: 'left' | 'center' | 'right';
    color?: string;          // CSS color for link text or button background
    textColor?: string;      // text color when style=button
    underline?: boolean;     // underline when style=link
    ariaLabel?: string;      // optional custom accessible label
    font?: 'system' | 'serif' | 'mono';
    fontSize?: number;
};

const def: WidgetDefinition<NavLinkProps> = {
    type: 'nav-link',
    label: 'Page Navigation',
    version: 1,
    defaultProps: {
        label: 'Go to page',
        targetPageId: 'page_home',
        style: 'link',
        align: 'left',
        color: '#2563eb',
        textColor: '#ffffff',
        underline: false,
        font: 'system',
        fontSize: undefined,
    },
    grid: { w: 3, h: 2 },
    zodSchema: z.object({
        label: z.string().min(1, 'Label is required'),
        targetPageId: z.string().min(1, 'Target page id is required').regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes, or underscores'),
        style: z.enum(['link', 'button']).optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
        color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$|^[a-zA-Z]+$/).optional(),
        textColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$|^[a-zA-Z]+$/).optional(),
        underline: z.boolean().optional(),
        ariaLabel: z.string().optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
    }),
    render: (props) => <NavLinkView {...props} />,
};

export default def;
