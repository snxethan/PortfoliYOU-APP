import React from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';

const def: WidgetDefinition<{ title: string; description?: string }> = {
    type: 'project',
    label: 'Project Card',
    defaultProps: { title: 'My Project', description: 'Short description' },
    grid: { w: 6, h: 4 },
    render: (props) => (
        <div className="p-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)]">
            <div className="font-medium mb-1">{props.title}</div>
            {props.description && <div className="text-xs text-[color:var(--fg-muted)]">{props.description}</div>}
        </div>
    ),
    zodSchema: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
    }),
};

export default def;
