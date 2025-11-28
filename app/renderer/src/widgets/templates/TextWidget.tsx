import React from 'react';

import type { WidgetDefinition, PropSchema } from '../types';
import { useWidgetConfig, validateProps } from '../sdk';

// 1) Define a schema for props
const schema: PropSchema = {
    text: { type: 'string', required: true, default: 'Edit me' },
    align: { type: 'string', default: 'left', validate: (v) => ['left', 'center', 'right'].includes(String(v)) || 'align must be left|center|right' },
};

// 2) Implement the widget definition
export const TextWidgetDef: WidgetDefinition<{ text: string; align?: 'left' | 'center' | 'right' }> = {
    type: 'text',
    label: 'Text Block',
    defaultProps: { text: 'Edit me', align: 'left' },
    version: 1,
    grid: { w: 4, h: 3 },
    schema,
    render: (props) => {
        const res = validateProps<{ text: string; align?: 'left' | 'center' | 'right' }>(schema, props);
        const p = res.value;
        return (
            <div className="text-sm" style={{ textAlign: p.align }}>
                {p.text}
            </div>
        );
    },
    // Provide static CSS declarations scoped per-instance for compiled sites
    getStaticCss: (props) => {
        const align = props?.align || 'left';
        const variantSize = props?.variant === 'h2' ? '28px' : props?.variant === 'h3' ? '20px' : '16px';
        return `text-align: ${align}; color: var(--widget-fg); font-family: var(--heading-font); font-size: ${variantSize};`;
    },
};

// 3) Optional: Config panel example using useWidgetConfig
export function TextWidgetConfigPanel({ initial }: { initial?: Partial<{ text: string; align?: 'left' | 'center' | 'right' }> }) {
    const { config, patch, errors } = useWidgetConfig(TextWidgetDef, initial);
    return (
        <div className="space-y-2 text-xs">
            <div>
                <label className="block mb-1">Text</label>
                <input className="input w-full" value={config.text} onChange={(e) => patch({ text: e.target.value })} />
            </div>
            <div>
                <label className="block mb-1">Align</label>
                <select className="input w-full" value={config.align} onChange={(e) => patch({ align: e.target.value as 'left' | 'center' | 'right' })}>
                    <option>left</option>
                    <option>center</option>
                    <option>right</option>
                </select>
            </div>
            {errors.length > 0 && (
                <div className="text-red-500">{errors.join(', ')}</div>
            )}
        </div>
    );
}
