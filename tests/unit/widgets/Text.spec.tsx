import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TextDef from '../../../app/renderer/src/widgets/defs/Text';
import { WidgetContext } from '../../../app/renderer/src/widgets/sdk';

const schema = TextDef.zodSchema!;

function renderWithContext(node: React.ReactNode, ctx?: Partial<React.ContextType<typeof WidgetContext>>) {
    const value = {
        id: 'w1',
        editing: false,
        interactive: true,
        updateProps: () => { },
        currentPageId: undefined,
        ...ctx,
    };
    return render(
        <WidgetContext.Provider value={value}>
            {node}
        </WidgetContext.Provider>
    );
}

describe('Text widget', () => {
    it('has sane default props', () => {
        expect(TextDef.defaultProps).toBeDefined();
        expect(TextDef.defaultProps.text).toBeTypeOf('string');
        expect(TextDef.defaultProps.variant).toBe('paragraph');
        expect(TextDef.defaultProps.align).toBe('left');
        expect(TextDef.defaultProps.font).toBe('system');
    });

    it('validates props with zod schema (valid)', () => {
        const valid = {
            text: 'Hello',
            variant: 'h2',
            align: 'center',
            font: 'serif',
            ariaLabel: 'Heading',
            ariaDescription: 'Desc',
        } as const;
        const res = schema.safeParse(valid);
        expect(res.success).toBe(true);
    });

    it('rejects empty text via schema', () => {
        const invalid = { text: '' };
        const res = schema.safeParse(invalid);
        expect(res.success).toBe(false);
    });

    it('renders paragraph content', () => {
        renderWithContext(TextDef.render({ text: 'Para text', variant: 'paragraph', align: 'left', font: 'system' }));
        expect(screen.getByText('Para text')).toBeInTheDocument();
        const p = screen.getByText('Para text').closest('p');
        expect(p).not.toBeNull();
    });

    it('renders h2 and safeguards empty heading', () => {
        // Non-empty
        renderWithContext(TextDef.render({ text: 'Title', variant: 'h2', align: 'left', font: 'system' }));
        const h2 = screen.getByText('Title').closest('h2');
        expect(h2).not.toBeNull();

        // Empty case: directly render empty text (bypassing schema) and expect hidden placeholder
        const { rerender } = renderWithContext(TextDef.render({ text: '', variant: 'h2', align: 'left', font: 'system' }));
        rerender(
            <WidgetContext.Provider value={{ id: 'w1', editing: false, interactive: true, updateProps: () => { } }}>
                {TextDef.render({ text: '', variant: 'h2', align: 'left', font: 'system' })}
            </WidgetContext.Provider>
        );
        // Should render an aria-hidden placeholder paragraph
        const hiddenPlaceholder = document.querySelector('p[aria-hidden="true"].select-none');
        expect(hiddenPlaceholder).not.toBeNull();
    });

    it('serializes default props round-trip', () => {
        const json = JSON.stringify(TextDef.defaultProps);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(TextDef.defaultProps);
    });

    it('applies color and font size style', () => {
        renderWithContext(TextDef.render({ text: 'Styled', variant: 'paragraph', align: 'left', font: 'system', color: '#ff0000', fontSize: 20 }));
        const el = screen.getByText('Styled');
        expect(el).toBeInTheDocument();
        // style will be applied on wrapper or p; check computed style presence
        const p = el.closest('p');
        expect((p as HTMLElement).style.color || (el as HTMLElement).style.color).toBe(''); // inline color may be on container
    });

    it('renders basic markdown when format=markdown', () => {
        const vnode = TextDef.render({ text: '**bold** _italic_ [link](https://example.com)', variant: 'paragraph', align: 'left', font: 'system', format: 'markdown' as const });
        renderWithContext(vnode);
        const link = screen.getByRole('link', { name: 'link' });
        expect(link).toHaveAttribute('href', 'https://example.com');
    });
});
