import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LinkDef from '../../../app/renderer/src/widgets/defs/Link';

const schema = LinkDef.zodSchema!;

describe('Link widget', () => {
    it('provides default props', () => {
        expect(LinkDef.defaultProps.url).toContain('https://');
        expect(LinkDef.defaultProps.label.length).toBeGreaterThan(0);
    });

    it('rejects unsupported protocols', () => {
        const result = schema.safeParse({ url: 'ftp://example.com', label: 'Bad' });
        expect(result.success).toBe(false);
    });

    it('accepts a trimmed url and renders anchor with target blank', () => {
        const parsed = schema.parse({ url: 'example.com', label: 'Docs' });
        expect(parsed.url).toBe('https://example.com/');
        const vnode = LinkDef.render({ ...parsed, variant: 'text' });
        const { container } = render(<>{vnode}</>);
        const anchor = container.querySelector('a');
        expect(anchor).toBeTruthy();
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toContain('noopener');
    });

    it('renders icon text when provided', () => {
        const vnode = LinkDef.render({
            url: 'https://example.com',
            label: 'Read more',
            variant: 'button',
            iconLeft: '★',
            iconRight: '→',
        });
        render(<>{vnode}</>);
        expect(screen.getByText('Read more')).toBeTruthy();
    });

    it('applies font options to the anchor', () => {
        const vnode = LinkDef.render({
            url: 'https://example.com',
            label: 'Styled',
            variant: 'text',
            font: 'mono',
            fontSize: 20,
            weight: 'bold',
            italic: true,
        });
        const { container } = render(<>{vnode}</>);
        const anchor = container.querySelector('a');
        expect(anchor?.style.fontFamily).toContain('monospace');
        expect(anchor?.style.fontStyle).toBe('italic');
        expect(anchor?.style.fontWeight).toBe('700');
    });
});
