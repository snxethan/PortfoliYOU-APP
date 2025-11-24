import React, { useId } from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { normalizeExternalLinkUrl } from '../utils/linkUrl';

type HeadingLevel = 'h2' | 'h3';
type FontChoice = 'system' | 'serif' | 'mono';

type ProjectWidgetProps = {
    title: string;
    description?: string;
    headingLevel?: HeadingLevel;
    ariaLabel?: string;
    ariaDescription?: string;
    font?: FontChoice;
    fontSize?: number;
    link?: string;
    image?: string;
    imageAlt?: string;
    linkLabel?: string;
};

function ProjectView(props: ProjectWidgetProps) {
    const id = useId();
    const H = (props.headingLevel || 'h3') as HeadingLevel;
    const ff = props.font === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
        : props.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
    const safeLink = normalizeExternalLinkUrl(props.link);
    const imageSrc = (props.image || '').trim();
    const accessibleLabel = props.ariaLabel || props.title;
    const descriptionId = props.ariaDescription ? `${id}-desc` : undefined;
    const imageAlt = props.imageAlt ?? props.title;

    const content = (
        <article
            className="p-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)] space-y-2"
            aria-label={props.ariaLabel}
            aria-labelledby={props.ariaLabel ? undefined : id}
            aria-describedby={descriptionId}
            style={{ fontFamily: ff, fontSize: props.fontSize ? `${props.fontSize}px` : undefined }}
        >
            {imageSrc && (
                <div className="w-full overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
                    <img src={imageSrc} alt={imageAlt} className="w-full h-40 object-cover" loading="lazy" referrerPolicy="no-referrer" />
                </div>
            )}
            <H id={id} className="font-medium mb-1">{props.title}</H>
            {props.description && <p className="text-xs">{props.description}</p>}
            {props.ariaDescription && (
                <p id={descriptionId} className="sr-only">{props.ariaDescription}</p>
            )}
        </article>
    );

    if (safeLink) {
        return (
            <a
                href={safeLink}
                target="_blank"
                rel="noreferrer"
                className="block no-underline text-current"
                aria-label={props.linkLabel || accessibleLabel}
                title={accessibleLabel}
            >
                {content}
            </a>
        );
    }

    return content;
}

const def: WidgetDefinition<ProjectWidgetProps> = {
    type: 'project',
    label: 'Project Card',
    version: 1,
    defaultProps: { title: 'My Project', description: 'Short description', headingLevel: 'h3', font: 'system', fontSize: undefined, link: undefined, image: undefined },
    grid: { w: 6, h: 4 },
    render: (props) => <ProjectView {...props} />,
    zodSchema: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        headingLevel: z.enum(['h2', 'h3']).optional(),
        ariaLabel: z.string().optional(),
        ariaDescription: z.string().optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
        link: z
            .string()
            .max(2048, 'Link is too long')
            .optional()
            .refine((value) => !value || Boolean(normalizeExternalLinkUrl(value)), { message: 'Enter a valid http(s) link' }),
        image: z
            .string()
            .max(1024, 'Image URL is too long')
            .optional(),
        imageAlt: z.string().max(200, 'Alt text is too long').optional(),
        linkLabel: z.string().max(160).optional(),
    }),
};

export default def;
