import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { useAssets } from '../../providers/AssetsProvider';

type CarouselMedia = 'image' | 'video';

export type CarouselItem = {
    id?: string;
    mediaType?: CarouselMedia;
    src?: string;
    assetId?: string; // legacy field kept for backward compatibility
    alt?: string;
    caption?: string;
    poster?: string;
};

type NormalizedItem = {
    id: string;
    mediaType: CarouselMedia;
    source: string;
    alt: string;
    caption?: string;
    poster?: string;
};

type Props = {
    items: CarouselItem[];
    autoPlay?: boolean;
    interval?: number; // ms
    backgroundColor?: string;
    shape?: 'rectangle' | 'rounded' | 'circle';
    radius?: number;
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
};

type DotControl =
    | { type: 'dot'; index: number }
    | { type: 'ellipsis'; key: string };

const DOT_VIRTUALIZATION_THRESHOLD = 10;
const DOT_WINDOW = 2;

const SAMPLE_SLIDES_PROPS: CarouselItem[] = [
    { id: 'sample-slide-1', mediaType: 'image', src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=60', alt: 'Design showcase', caption: 'Show your best work' },
    { id: 'sample-slide-2', mediaType: 'image', src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=60', alt: 'In-progress shot', caption: 'Walk through your process' },
    { id: 'sample-slide-3', mediaType: 'image', src: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=600&q=60', alt: 'Hero moment', caption: 'Highlight what matters' },
];

function resolveHashish(src: string | undefined): string {
    if (!src) return '';
    if (src.startsWith('asset://')) return src;
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
    return `asset://${src}`;
}

function normalizeItems(items?: CarouselItem[]): NormalizedItem[] {
    const provided = Array.isArray(items);
    const base = provided ? (items as CarouselItem[]) : SAMPLE_SLIDES_PROPS;
    const normalized = base.map((raw, idx) => {
        const mediaType: CarouselMedia = raw.mediaType === 'video' ? 'video' : 'image';
        const source = resolveHashish(raw.src || raw.assetId || '');
        return {
            id: raw.id || `slide-${idx}-${source || 'empty'}`,
            mediaType,
            source,
            alt: raw.alt || (mediaType === 'video' ? 'Video slide' : 'Image slide'),
            caption: raw.caption,
            poster: raw.poster ? resolveHashish(raw.poster) : undefined,
        };
    }).filter(it => !!it.source);
    if (provided && (!items || items.length === 0)) {
        return [];
    }
    return normalized;
}

function buildDotControls(slides: NormalizedItem[], activeIndex: number): DotControl[] {
    const count = slides.length;
    if (count <= DOT_VIRTUALIZATION_THRESHOLD) {
        return slides.map((_, idx) => ({ type: 'dot', index: idx }));
    }
    const indices = new Set<number>();
    indices.add(0);
    indices.add(count - 1);
    for (let offset = -DOT_WINDOW; offset <= DOT_WINDOW; offset += 1) {
        const target = activeIndex + offset;
        if (target > 0 && target < count - 1) indices.add(target);
    }
    const sorted = Array.from(indices).sort((a, b) => a - b);
    const controls: DotControl[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (i > 0) {
            const prev = sorted[i - 1];
            if (current - prev > 1) {
                controls.push({ type: 'ellipsis', key: `ellipsis-${prev}-${current}` });
            }
        }
        controls.push({ type: 'dot', index: current });
    }
    return controls;
}

function useResolvedSource(src: string) {
    const { getUrl } = useAssets();
    const [resolved, setResolved] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        async function go() {
            try {
                if (!src) { if (alive) setResolved(null); return; }
                if (src.startsWith('asset://')) {
                    const hash = src.slice('asset://'.length);
                    const url = await getUrl(hash);
                    if (alive) setResolved(url);
                    return;
                }
                if (alive) setResolved(src);
            } catch {
                if (alive) setResolved(null);
            }
        }
        void go();
        return () => { alive = false; };
    }, [src, getUrl]);
    return resolved;
}

function ResolvedImage({ src, alt }: { src: string; alt: string }) {
    const resolved = useResolvedSource(src);
    if (!resolved) return <div className="w-full h-full bg-[color:var(--muted)]/40" />;
    return <img src={resolved} alt={alt} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
}

function ResolvedVideo({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
    const resolved = useResolvedSource(src);
    const resolvedPoster = useResolvedSource(poster || '');
    if (!resolved) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[color:var(--muted)]/30 text-[color:var(--fg-muted)] text-xs">
                Video unavailable
            </div>
        );
    }
    return (
        <video
            src={resolved}
            poster={resolvedPoster || undefined}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            aria-label={alt || 'Carousel video'}
        />
    );
}

const def: WidgetDefinition<Props> = {
    type: 'carousel',
    label: 'Carousel',
    defaultProps: {
        items: SAMPLE_SLIDES_PROPS,
        autoPlay: true,
        interval: 4000,
        shape: 'rectangle',
        radius: 12,
        borderWidth: 0,
        borderColor: '#000000',
        borderStyle: 'solid',
    },
    grid: { w: 6, h: 4 },
    render: (props) => {
        const slides = useMemo(() => normalizeItems(props.items), [props.items]);
        const n = slides.length;
        const [index, setIndex] = useState(0);
        const startX = useRef<number | null>(null);
        const [isHovering, setIsHovering] = useState(false);

        useEffect(() => {
            if (n === 0) { setIndex(0); return; }
            if (index >= n) setIndex(n - 1);
        }, [n, index]);

        useEffect(() => {
            if (!props.autoPlay || n < 2 || isHovering) return;
            const t = Math.max(800, Number(props.interval || 3000));
            const id = setInterval(() => setIndex((i) => (i + 1) % n), t);
            return () => clearInterval(id);
        }, [props.autoPlay, props.interval, n, isHovering]);

        const prev = () => { if (n > 0) setIndex((i) => (i - 1 + n) % n); };
        const next = () => { if (n > 0) setIndex((i) => (i + 1) % n); };

        const onKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
            else if (e.key === 'Home') { e.preventDefault(); if (n) setIndex(0); }
            else if (e.key === 'End') { e.preventDefault(); if (n) setIndex(n - 1); }
        };

        const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
        const onPointerUp = (e: React.PointerEvent) => {
            if (startX.current == null) return;
            const dx = e.clientX - startX.current;
            startX.current = null;
            const threshold = 40;
            if (dx > threshold) prev();
            else if (dx < -threshold) next();
        };
        const onPointerCancel = () => { startX.current = null; setIsHovering(false); };
        const onPointerLeave = () => { startX.current = null; setIsHovering(false); };
        const onPointerEnter = () => setIsHovering(true);

        const active = slides[index];

        const stopDragPropagation = (e: React.PointerEvent | React.MouseEvent) => {
            e.stopPropagation();
        };

        const shape = (props.shape || 'rectangle') as 'rectangle' | 'rounded' | 'circle';
        const frameRadius = shape === 'circle' ? '999px' : shape === 'rounded' ? Math.max(0, props.radius ?? 12) : 0;
        const frameBorderWidth = Math.max(0, props.borderWidth ?? 0);
        const frameBorderColor = props.borderColor || 'var(--border)';
        const frameBorderStyle = props.borderStyle || 'solid';
        const frameBackground = props.backgroundColor || 'var(--surface)';

        const dotControls = useMemo(() => buildDotControls(slides, index), [slides, index]);

        return (
            <div
                className="w-full h-full relative"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onPointerEnter={onPointerEnter}
                onPointerLeave={onPointerLeave}
                role="region"
                aria-roledescription="carousel"
                aria-label="Media carousel"
            >
                <div
                    className="w-full h-full overflow-hidden relative"
                    style={{
                        borderRadius: frameRadius,
                        background: frameBackground,
                        borderWidth: frameBorderWidth,
                        borderColor: frameBorderColor,
                        borderStyle: frameBorderWidth > 0 ? frameBorderStyle : undefined,
                        boxSizing: 'border-box',
                    }}
                >
                    {n > 0 && active ? (
                        <div className="w-full h-full">
                            {active.mediaType === 'video' ? (
                                <ResolvedVideo src={active.source} poster={active.poster} alt={active.alt} />
                            ) : (
                                <ResolvedImage src={active.source} alt={active.alt} />
                            )}
                            {active.caption && (
                                <div className="absolute left-0 right-0 bottom-0 text-xs p-2 bg-[color:var(--surface)]/90 text-[color:var(--fg)]">
                                    {active.caption}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[color:var(--fg-muted)]/70 text-xs">
                            Add slides to start your carousel
                        </div>
                    )}
                </div>

                {n > 1 && (
                    <>
                        <button
                            type="button"
                            data-nodrag="true"
                            className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs text-[color:var(--fg)] bg-[color:var(--surface)]/80 border border-[color:var(--border)] hover:bg-[color:var(--surface)]"
                            aria-label="Previous slide"
                            onPointerDownCapture={stopDragPropagation}
                            onClick={(e) => { e.stopPropagation(); prev(); }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        <button
                            type="button"
                            data-nodrag="true"
                            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs text-[color:var(--fg)] bg-[color:var(--surface)]/80 border border-[color:var(--border)] hover:bg-[color:var(--surface)]"
                            aria-label="Next slide"
                            onPointerDownCapture={stopDragPropagation}
                            onClick={(e) => { e.stopPropagation(); next(); }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                    </>
                )}

                {n > 1 && (
                    <div className="absolute left-0 right-0 bottom-2 flex items-center justify-center gap-2">
                        {dotControls.map((control) => {
                            if (control.type === 'ellipsis') {
                                return (
                                    <span key={control.key} className="text-[color:var(--fg-muted)] text-xs select-none">
                                        …
                                    </span>
                                );
                            }
                            const targetIndex = control.index;
                            const slide = slides[targetIndex];
                            return (
                                <button
                                    key={slide?.id || targetIndex}
                                    type="button"
                                    data-nodrag="true"
                                    className={`rounded-full border ${targetIndex === index ? 'bg-[color:var(--fg)] border-[color:var(--fg)]' : 'bg-[color:var(--fg)]/40 border-[color:var(--fg)]/40'}`}
                                    style={{ width: 8, height: 8 }}
                                    aria-label={`Go to slide ${targetIndex + 1}`}
                                    aria-current={targetIndex === index}
                                    onPointerDownCapture={stopDragPropagation}
                                    onClick={(e) => { e.stopPropagation(); setIndex(targetIndex); }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        );
    },
    zodSchema: z.object({
        autoPlay: z.boolean().optional(),
        interval: z.number().min(500).max(60000).optional(),
        backgroundColor: z.string().min(1).optional(),
        shape: z.enum(['rectangle', 'rounded', 'circle']).optional(),
        radius: z.number().min(0).max(200).optional(),
        borderWidth: z.number().min(0).max(48).optional(),
        borderColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
        borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    }),
};

export default def;
