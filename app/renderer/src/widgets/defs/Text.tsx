import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import type { WidgetDefinition } from '../types';
import { useWidget } from '../sdk';

type TextVariant = 'paragraph' | 'h2' | 'h3';
type TextAlign = 'left' | 'center' | 'right';
type FontChoice = 'system' | 'serif' | 'mono';
type TextFormat = 'plain' | 'markdown';

// Stable component so local editing state persists across renders
function TextViewComp(p: { text: string; variant?: TextVariant; align?: TextAlign; font?: FontChoice; ariaLabel?: string; ariaDescription?: string; color?: string; fontSize?: number; weight?: 'normal' | 'bold'; italic?: boolean; format?: TextFormat }) {
    const { editing, updateProps } = useWidget();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(p.text);
    const variant: TextVariant = (p.variant || 'paragraph') as TextVariant;
    const common = {
        'aria-label': p.ariaLabel || undefined,
        'aria-description': p.ariaDescription || undefined,
        onContextMenu: (e: React.MouseEvent) => {
            if (!editing) return;
            e.preventDefault();
            setDraft(p.text);
            setIsEditing(true);
        },
    } as React.HTMLAttributes<HTMLElement>;

    const ff = p.font === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
        : p.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
    const alignStyle: React.CSSProperties = {
        textAlign: (p.align || 'left') as React.CSSProperties['textAlign'],
        fontFamily: ff,
        color: p.color || undefined,
        fontSize: p.fontSize ? `${p.fontSize}px` : undefined,
        fontWeight: p.weight || undefined,
        fontStyle: p.italic ? 'italic' : undefined,
    };

    const html = useMemo(() => {
        if ((p.format || 'plain') !== 'markdown') return null;
        const raw = marked.parse(p.text || '');
        const safe = DOMPurify.sanitize(String(raw));
        return safe;
    }, [p.text, p.format]);

    if (editing && isEditing) {
        return (
            <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
                <textarea
                    data-nodrag="true"
                    className="input w-full h-full min-h-[3rem]"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => { updateProps({ text: draft }); setIsEditing(false); }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                            e.preventDefault();
                            updateProps({ text: draft });
                            setIsEditing(false);
                        }
                    }}
                    aria-label={p.ariaLabel || 'Text content editor'}
                    style={alignStyle}
                />
            </div>
        );
    }

    const headingWeight = p.weight ? p.weight : 'bold';
    return (
        <div className="w-full h-full" onContextMenu={common.onContextMenu} aria-label={common['aria-label']} aria-description={common['aria-description']} style={alignStyle}>
            {variant === 'h2' ? (
                (p.text.trim().length > 0 ? (
                    <h2 style={{ fontWeight: headingWeight }}>{p.text}</h2>
                ) : (
                    <p aria-hidden="true" className="select-none" style={{ fontWeight: headingWeight, color: 'transparent' }}>.</p>
                ))
            ) : variant === 'h3' ? (
                (p.text.trim().length > 0 ? (
                    <h3 style={{ fontWeight: headingWeight }}>{p.text}</h3>
                ) : (
                    <p aria-hidden="true" className="select-none" style={{ fontWeight: headingWeight, color: 'transparent' }}>.</p>
                ))
            ) : (
                (p.format === 'markdown' ? (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html || '' }} />
                ) : (
                    <p>{p.text}</p>
                ))
            )}
        </div>
    );
}

const def: WidgetDefinition<{ text: string; variant?: TextVariant; align?: TextAlign; font?: FontChoice; ariaLabel?: string; ariaDescription?: string; color?: string; fontSize?: number; weight?: 'normal' | 'bold'; italic?: boolean; format?: TextFormat }> = {
    type: 'text',
    label: 'Text Block',
    version: 1,
    defaultProps: { text: 'Edit me', variant: 'paragraph', align: 'left', font: 'system', color: undefined, fontSize: undefined, weight: 'normal', italic: false, format: 'plain' },
    grid: { w: 3, h: 1 },
    render: (props) => {
        return <TextViewComp {...props} />;
    },
    zodSchema: z.object({
        text: z.string().min(1, 'Text is required'),
        variant: z.enum(['paragraph', 'h2', 'h3']).optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        ariaLabel: z.string().optional(),
        ariaDescription: z.string().optional(),
        color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$|^[a-zA-Z]+$/, 'Enter a valid CSS color').optional(),
        fontSize: z.number().min(8).max(128).optional(),
        weight: z.enum(['normal', 'bold']).optional(),
        italic: z.boolean().optional(),
        format: z.enum(['plain', 'markdown']).optional(),
    }),
};

export default def;
