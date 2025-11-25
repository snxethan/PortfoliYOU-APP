import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import NavLinkDef from '../../../app/renderer/src/widgets/defs/NavLink';
import { WidgetContext } from '../../../app/renderer/src/widgets/sdk';

const schema = NavLinkDef.zodSchema!;

function withCtx(node: React.ReactNode, ctx?: Partial<React.ContextType<typeof WidgetContext>>) {
    const value = { id: 'w1', editing: false, interactive: true, updateProps: () => { }, currentPageId: undefined, ...ctx };
    return render(<WidgetContext.Provider value={value}>{node}</WidgetContext.Provider>);
}

describe('NavLink widget', () => {
    it('has default props', () => {
        expect(NavLinkDef.defaultProps.label).toBeTypeOf('string');
        expect(NavLinkDef.defaultProps.targetPageId).toBeTypeOf('string');
    });

    it('validates props with zod (valid)', () => {
        const ok = schema.safeParse({ label: 'Home', targetPageId: 'home_1', style: 'link', color: '#000', underline: true });
        expect(ok.success).toBe(true);
    });

    it('rejects invalid targetPageId', () => {
        const bad = schema.safeParse({ label: 'Home', targetPageId: 'bad id' });
        expect(bad.success).toBe(false);
    });

    it('renders and sets aria-current for current page', () => {
        const vnode = NavLinkDef.render({ ...NavLinkDef.defaultProps, targetPageId: 'p1', label: 'Go' });
        withCtx(vnode, { currentPageId: 'p1' });
        const link = screen.getByRole('link', { name: /go/i });
        expect(link).toHaveAttribute('href', '#/page/p1');
        expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('serializes default props', () => {
        const json = JSON.stringify(NavLinkDef.defaultProps);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(NavLinkDef.defaultProps);
    });
});
