import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import VideoDef from '../../../app/renderer/src/widgets/defs/Video';
import { sanitizeVideoProps } from '../../../app/renderer/src/widgets/videoProps';

const schema = VideoDef.zodSchema!;

describe('Video widget', () => {
    it('exposes safe defaults', () => {
        expect(VideoDef.defaultProps.src).toBe('');
        expect(VideoDef.defaultProps.controls).toBe(true);
        expect(VideoDef.defaultProps.autoplay).toBe(false);
        expect(VideoDef.defaultProps.shape).toBe('rectangle');
        expect(VideoDef.defaultProps.borderWidth).toBe(0);
    });

    it('accepts a YouTube URL', () => {
        const result = schema.safeParse({ src: 'https://youtu.be/dQw4w9WgXcQ' });
        expect(result.success).toBe(true);
    });

    it('supports styled frames', () => {
        const result = schema.safeParse({ src: 'https://example.com/video.mp4', shape: 'rounded', borderWidth: 4, borderColor: '#ff0000', borderStyle: 'dashed' });
        expect(result.success).toBe(true);
    });

    it('accepts an uploaded asset', () => {
        const result = schema.safeParse({ src: 'asset://abc123', poster: 'asset://poster123' });
        expect(result.success).toBe(true);
    });

    it('rejects unsupported protocols', () => {
        const result = schema.safeParse({ src: 'ftp://example.com/video.mp4' });
        expect(result.success).toBe(false);
    });

    it('renders default placeholder without crashing', () => {
        const vnode = VideoDef.render(VideoDef.defaultProps);
        const { container } = render(<>{vnode}</>);
        expect(container).toBeTruthy();
    });

    describe('sanitizeVideoProps', () => {
        it('strips disallowed protocols', () => {
            const safe = sanitizeVideoProps({ src: 'javascript:alert(1)', poster: 'ftp://example.com/poster.png' });
            expect(safe.src).toBe('');
            expect(safe.poster).toBeUndefined();
        });

        it('removes HTML from fallback text and clamps borders', () => {
            const safe = sanitizeVideoProps({ fallbackText: '<script>alert(1)</script>Oops', borderWidth: 999, borderRadius: -10, shape: 'triangle' as never });
            expect(safe.fallbackText).toBe('Oops');
            expect(safe.borderWidth).toBeLessThanOrEqual(48);
            expect(safe.borderRadius).toBeGreaterThanOrEqual(0);
            expect(safe.shape).toBe('rectangle');
        });
    });
});
