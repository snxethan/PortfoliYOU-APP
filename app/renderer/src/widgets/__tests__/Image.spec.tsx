import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ImageDef from '../defs/Image';

// For default render (src='') the widget returns an empty container and does not
// resolve assets, so no provider mocking is needed.

describe('Image widget', () => {
    it('has default props', () => {
        expect(ImageDef.defaultProps.fit).toBe('contain');
        expect(ImageDef.defaultProps.shape).toBe('rectangle');
    });

    it('zod validates valid props', () => {
        const ok = ImageDef.zodSchema.safeParse({ src: '', alt: 'Img', fit: 'cover', radius: 4, scale: 1, shape: 'rounded' });
        expect(ok.success).toBe(true);
    });

    it('zod rejects invalid src format', () => {
        const bad = ImageDef.zodSchema.safeParse({ src: 'invalid-url', alt: 'Img' });
        expect(bad.success).toBe(false);
    });

    it('renders without crashing with default props', () => {
        const vnode = ImageDef.render(ImageDef.defaultProps);
        // render should not throw
        const { container } = render(<>{vnode}</>);
        expect(container).toBeTruthy();
    });

    it('serializes default props', () => {
        const json = JSON.stringify(ImageDef.defaultProps);
        expect(JSON.parse(json)).toEqual(ImageDef.defaultProps);
    });
});
