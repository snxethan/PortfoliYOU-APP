import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ProjectDef from '../../../app/renderer/src/widgets/defs/Project';
import { WidgetContext } from '../../../app/renderer/src/widgets/sdk';

const schema = ProjectDef.zodSchema!;

function withCtx(node: React.ReactNode) {
    const value = { id: 'w1', editing: false, interactive: true, updateProps: () => { } } as const;
    return render(<WidgetContext.Provider value={value}>{node}</WidgetContext.Provider>);
}

describe('Project widget', () => {
    it('has default props', () => {
        expect(ProjectDef.defaultProps.title).toBeTypeOf('string');
        expect(ProjectDef.defaultProps.headingLevel).toBe('h3');
    });

    it('zod validates valid props', () => {
        const ok = schema.safeParse({ title: 'T', description: 'D', headingLevel: 'h2' });
        expect(ok.success).toBe(true);
    });

    it('zod rejects missing title', () => {
        const bad = schema.safeParse({ title: '' });
        expect(bad.success).toBe(false);
    });

    it('renders article with heading', () => {
        const vnode = ProjectDef.render({ ...ProjectDef.defaultProps, title: 'My Project', headingLevel: 'h2' });
        withCtx(vnode);
        const article = screen.getByRole('article');
        const h = screen.getByRole('heading', { name: 'My Project', level: 2 });
        expect(article).toBeInTheDocument();
        expect(h).toBeInTheDocument();
    });

    it('serializes default props', () => {
        const json = JSON.stringify(ProjectDef.defaultProps);
        expect(JSON.parse(json)).toEqual(ProjectDef.defaultProps);
    });
});
