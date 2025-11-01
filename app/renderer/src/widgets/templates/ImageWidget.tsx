import React from 'react';

import type { WidgetDefinition, PropSchema } from '../types';
import { useWidgetConfig, validateProps } from '../sdk';

const schema: PropSchema = {
    src: { type: 'string', required: true, default: '' },
    alt: { type: 'string', default: '' },
    fit: { type: 'string', default: 'contain', validate: (v) => ['contain', 'cover', 'fill', 'none', 'scale-down'].includes(String(v)) || 'fit must be a valid object-fit' },
};

export const ImageWidgetDef: WidgetDefinition<{ src: string; alt?: string; fit?: React.CSSProperties['objectFit'] }> = {
    type: 'image',
    label: 'Image',
    defaultProps: { src: '', alt: '', fit: 'contain' },
    grid: { w: 4, h: 4 },
    schema,
    render: (props) => {
        const res = validateProps<{ src: string; alt?: string; fit?: React.CSSProperties['objectFit'] }>(schema, props);
        const p = res.value;
        return (
            <div className="w-full h-full flex items-center justify-center bg-[color:var(--muted)]/30 text-xs text-[color:var(--fg-muted)] border border-dashed border-[color:var(--border)]">
                {p.src ? (
                    <img src={p.src} alt={p.alt || ''} style={{ objectFit: p.fit }} className="max-w-full max-h-full" />
                ) : 'Image placeholder'}
            </div>
        );
    },
};

export function ImageWidgetConfigPanel({ initial }: { initial?: Partial<{ src: string; alt?: string; fit?: React.CSSProperties['objectFit'] }> }) {
    const { config, patch, errors } = useWidgetConfig(ImageWidgetDef, initial);
    return (
        <div className="space-y-2 text-xs">
            <div>
                <label className="block mb-1">Source URL</label>
                <input className="input w-full" value={config.src} onChange={(e) => patch({ src: e.target.value })} />
            </div>
            <div>
                <label className="block mb-1">Alt text</label>
                <input className="input w-full" value={config.alt} onChange={(e) => patch({ alt: e.target.value })} />
            </div>
            <div>
                <label className="block mb-1">Object Fit</label>
                <select
                    className="input w-full"
                    value={config.fit}
                    onChange={(e) => patch({ fit: e.target.value as React.CSSProperties['objectFit'] })}
                >
                    <option>contain</option>
                    <option>cover</option>
                    <option>fill</option>
                    <option>none</option>
                    <option>scale-down</option>
                </select>
            </div>
            {errors.length > 0 && (
                <div className="text-red-500">{errors.join(', ')}</div>
            )}
        </div>
    );
}
