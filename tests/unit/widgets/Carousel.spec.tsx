import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../app/renderer/src/providers/AssetsProvider', () => ({
    useAssets: () => ({
        getUrl: async () => null,
    }),
}));

import CarouselDef, { type CarouselItem } from '../../../app/renderer/src/widgets/defs/Carousel';

function renderCarousel(props: Parameters<typeof CarouselDef.render>[0]) {
    const Component = CarouselDef.render as React.ComponentType<typeof props>;
    return render(<Component {...props} />);
}

describe('Carousel widget', () => {
    it('provides default slides', () => {
        expect(Array.isArray(CarouselDef.defaultProps.items)).toBe(true);
        expect(CarouselDef.defaultProps.items.length).toBeGreaterThan(0);
    });

    it('zod validates interval range', () => {
        const schema = CarouselDef.zodSchema!;
        const ok = schema.safeParse({ autoPlay: true, interval: 1500 });
        expect(ok.success).toBe(true);
        const bad = schema.safeParse({ autoPlay: true, interval: 200 });
        expect(bad.success).toBe(false);
    });

    it('renders with mixed media slides', () => {
        const { container } = renderCarousel({
            items: [
                { mediaType: 'image', src: 'https://example.com/a.jpg', alt: 'Slide A' },
                { mediaType: 'video', src: 'https://example.com/b.mp4', poster: 'https://example.com/b.jpg', alt: 'Slide B' },
            ],
            autoPlay: false,
            interval: 2000,
        });
        expect(container).toBeTruthy();
    });

    it('loops forward from last slide back to first', () => {
        const { getByLabelText, getAllByRole } = renderCarousel({
            items: [
                { mediaType: 'image', src: 'https://example.com/1.jpg', alt: 'One' },
                { mediaType: 'image', src: 'https://example.com/2.jpg', alt: 'Two' },
            ],
            autoPlay: false,
        });
        const next = getByLabelText('Next slide');
        fireEvent.click(next); // go to second slide
        fireEvent.click(next); // wrap to first
        const dots = getAllByRole('button', { name: /Go to slide/ });
        expect(dots[0].getAttribute('aria-current')).toBe('true');
    });

    it('loops backward from first slide to last', () => {
        const { getByLabelText, getAllByRole } = renderCarousel({
            items: [
                { mediaType: 'image', src: 'https://example.com/1.jpg', alt: 'One' },
                { mediaType: 'image', src: 'https://example.com/2.jpg', alt: 'Two' },
                { mediaType: 'image', src: 'https://example.com/3.jpg', alt: 'Three' },
            ],
            autoPlay: false,
        });
        const prev = getByLabelText('Previous slide');
        fireEvent.click(prev);
        const dots = getAllByRole('button', { name: /Go to slide/ });
        expect(dots[2].getAttribute('aria-current')).toBe('true');
    });

    it('virtualizes navigation dots when slides exceed threshold', () => {
        const items: CarouselItem[] = Array.from({ length: 12 }, (_, idx) => ({
            mediaType: 'image',
            src: `https://example.com/${idx}.jpg`,
            alt: `Slide ${idx}`,
        }));
        const { getAllByRole, queryAllByText } = renderCarousel({ items, autoPlay: false });
        const dots = getAllByRole('button', { name: /Go to slide/ });
        expect(dots.length).toBeLessThan(items.length);
        expect(queryAllByText('…').length).toBeGreaterThan(0);
    });
});
