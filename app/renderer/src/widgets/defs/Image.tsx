import React from 'react';

import type { WidgetDefinition } from '../types';

const def: WidgetDefinition<{ src: string; alt?: string }> = {
    type: 'image',
    label: 'Image',
    defaultProps: { src: '', alt: '' },
    grid: { w: 4, h: 4 },
    render: (props) => (
        <div className="w-full h-full flex items-center justify-center bg-[color:var(--muted)]/30 text-xs text-[color:var(--fg-muted)] border border-dashed border-[color:var(--border)]">
            {props.src ? <img src={props.src} alt={props.alt || ''} className="max-w-full max-h-full object-contain" /> : 'Image placeholder'}
        </div>
    ),
};

export default def;
