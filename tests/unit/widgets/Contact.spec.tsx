import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ContactDef from '../../../app/renderer/src/widgets/defs/Contact';
import { WidgetContext } from '../../../app/renderer/src/widgets/sdk';

const schema = ContactDef.zodSchema!;

function withCtx(node: React.ReactNode, ctx?: Partial<React.ContextType<typeof WidgetContext>>) {
    const value = { id: 'w1', editing: false, interactive: true, updateProps: () => { }, ...ctx };
    return render(<WidgetContext.Provider value={value}>{node}</WidgetContext.Provider>);
}

describe('Contact widget', () => {
    it('has default props', () => {
        expect(ContactDef.defaultProps.submitAction).toBe('mailto');
        expect(ContactDef.defaultProps.liveMode).toBe('polite');
    });

    it('zod validates valid props', () => {
        const ok = schema.safeParse({
            heading: 'Contact',
            submitAction: 'event',
            mailtoTo: '',
        });
        expect(ok.success).toBe(true);
    });

    it('zod rejects invalid mailto email', () => {
        const bad = schema.safeParse({ mailtoTo: 'not-an-email' });
        expect(bad.success).toBe(false);
    });

    it('renders labels and inputs', () => {
        const vnode = ContactDef.render({ ...ContactDef.defaultProps, heading: 'Contact me' });
        withCtx(vnode, { editing: false, interactive: true });
        expect(screen.getByRole('heading', { level: 3, name: 'Contact me' })).toBeInTheDocument();
        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('serializes default props', () => {
        const json = JSON.stringify(ContactDef.defaultProps);
        expect(JSON.parse(json)).toEqual(ContactDef.defaultProps);
    });
});
