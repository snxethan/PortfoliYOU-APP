import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';

const def: WidgetDefinition<{ text: string }> = {
    type: 'text',
    label: 'Text Block',
    defaultProps: { text: 'Edit me' },
    grid: { w: 4, h: 3 },
    render: (props) => <div className="text-sm text-[color:var(--fg)]">{props.text}</div>,
    zodSchema: z.object({
        text: z.string().min(1, 'Text is required'),
    }),
};

export default def;
