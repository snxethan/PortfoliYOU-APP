import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import type { WidgetDefinition } from '../types';
import { useAssets } from '../../providers/AssetsProvider';

function ResolveAssetImg({ src, alt, fit, scale }: { src: string; alt?: string; fit?: React.CSSProperties['objectFit']; scale?: number }) {
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
                } else if (src.startsWith('assets/')) {
                    // Legacy relative path in project archive; these should be migrated on import
                    // Show placeholder until migrated
                    if (alive) setResolved(null);
                } else {
                    if (alive) setResolved(src);
                }
            } catch { if (alive) setResolved(null); }
        }
        void go();
        return () => { alive = false; };
    }, [src, getUrl]);
    if (!resolved) return null;
    return (
        <img
            src={resolved}
            alt={alt || ''}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: fit || 'contain', objectPosition: 'center center', transform: scale && scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'center center' }}
        />
    );
}

type Shape = 'rectangle' | 'rounded' | 'circle';

const def: WidgetDefinition<{ src: string; alt?: string; fit?: React.CSSProperties['objectFit']; radius?: number; scale?: number; shape?: Shape; borderWidth?: number; borderColor?: string; borderStyle?: 'solid' | 'dashed' | 'dotted' }> = {
    type: 'image',
    label: 'Image',
    defaultProps: { src: '', alt: '', fit: 'contain', radius: 8, scale: 1, shape: 'rectangle', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid' },
    grid: { w: 2, h: 2 },
    render: (props) => {
        const hasSrc = !!props.src;
        // compute border radius based on shape
        const shape = (props.shape || 'rectangle') as Shape;
        const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? (typeof props.radius === 'number' ? props.radius : 8) : 0;
        const bw = typeof props.borderWidth === 'number' ? Math.max(0, props.borderWidth) : 0;
        const bc = typeof props.borderColor === 'string' ? props.borderColor : '#000000';
        const bs = (props.borderStyle || 'solid') as 'solid' | 'dashed' | 'dotted';
        return hasSrc ? (
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: radius as number | string, borderWidth: bw, borderColor: bc, borderStyle: bw > 0 ? bs : undefined, boxSizing: 'border-box' }}>
                <ResolveAssetImg src={props.src} alt={props.alt} fit={props.fit} scale={props.scale} />
            </div>
        ) : (
            <div style={{ width: '100%', height: '100%' }} />
        );
    },
    zodSchema: z.object({
        // Accept http(s), data URLs, asset://hash, or relative assets/... (migrated on import)
        src: z.string().refine((v) => {
            if (v === '') return true;
            if (v.startsWith('asset://') || v.startsWith('assets/')) return true;
            try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:'; } catch { return false; }
        }, { message: 'Enter a valid URL or choose an image.' }).transform((v) => v),
        alt: z.string().optional(),
        fit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
        radius: z.number().min(0).optional(),
        scale: z.number().min(0.1).max(4).optional(),
        shape: z.enum(['rectangle', 'rounded', 'circle']).optional(),
        borderWidth: z.number().min(0).max(48).optional(),
        borderColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
        borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    }),
};

export default def;
