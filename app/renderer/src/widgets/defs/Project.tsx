import React, { useId } from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';

type HeadingLevel = 'h2' | 'h3';
type FontChoice = 'system' | 'serif' | 'mono';

function ProjectView(props: { title: string; description?: string; headingLevel?: HeadingLevel; ariaLabel?: string; font?: FontChoice; fontSize?: number }) {
    const id = useId();
    const H = (props.headingLevel || 'h3') as HeadingLevel;
    const ff = props.font === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
        : props.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
    return (
        <article className="p-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)]" aria-label={props.ariaLabel} aria-labelledby={props.ariaLabel ? undefined : id} style={{ fontFamily: ff, fontSize: props.fontSize ? `${props.fontSize}px` : undefined }}>
            <H id={id} className="font-medium mb-1">{props.title}</H>
            {props.description && <p className="text-xs">{props.description}</p>}
        </article>
    );
}

const def: WidgetDefinition<{ title: string; description?: string; headingLevel?: HeadingLevel; ariaLabel?: string; font?: FontChoice; fontSize?: number }> = {
    type: 'project',
    label: 'Project Card',
    defaultProps: { title: 'My Project', description: 'Short description', headingLevel: 'h3', font: 'system', fontSize: undefined },
    grid: { w: 6, h: 4 },
    render: (props) => <ProjectView {...props} />,
    zodSchema: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        headingLevel: z.enum(['h2', 'h3']).optional(),
        ariaLabel: z.string().optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
    }),
};

export default def;
