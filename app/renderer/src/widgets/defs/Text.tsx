import React from 'react';

import type { WidgetDefinition } from '../types';

const def: WidgetDefinition<{ text: string }> = {
    type: 'text',
    label: 'Text Block',
    defaultProps: { text: 'Edit me' },
    grid: { w: 4, h: 3 },
    render: (props) => <div className="text-sm text-[color:var(--fg)]">{props.text}</div>,
};

export default def;
