import React, { useState } from 'react';
import { z } from 'zod';
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Images,
    Palette,
    Unlock,
    Timer,
    Image as ImageIcon,
    Video,
    GripVertical,
    Trash2,
    UploadCloud,
} from 'lucide-react';

import type { AssetsCtx } from '../../providers/AssetsProvider';

import {
    deriveNumberBounds,
    HEX_COLOR_RE,
    IMAGE_BORDER_STYLES,
    IMAGE_SHAPES,
} from './shared';
import type { WidgetSettingsComponentProps } from './types';

export type CarouselEditorItem = {
    id: string;
    mediaType: 'image' | 'video';
    source: string;
    alt: string;
    caption: string;
    poster?: string;
};

type SectionKey = 'slides' | 'behavior' | 'typography' | 'accessibility';

type CarouselWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
    items: CarouselEditorItem[];
    assets: AssetsCtx;
    imageAssets: AssetsCtx['list'];
    videoAssets: AssetsCtx['list'];
    onAddSlide: () => void;
    onRemoveSlide: (id: string) => void;
    onMoveSlide: (id: string, direction: -1 | 1) => void;
    onUpdateSlide: (id: string, patch: Partial<CarouselEditorItem>) => void;
    carouselError: string | null;
};

const SectionCard = ({ sectionKey, title, icon, children, sectionsOpen, toggleSection }: {
    sectionKey: SectionKey;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    sectionsOpen: Record<SectionKey, boolean>;
    toggleSection: (key: SectionKey) => void;
}) => {
    const open = sectionsOpen[sectionKey];
    return (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 shadow-sm">
            <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
                onClick={() => toggleSection(sectionKey)}
                aria-expanded={open}
            >
                <span className="flex items-center gap-2 text-[color:var(--fg)]">
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="flex items-center gap-2">
                        {icon}
                        {title}
                    </span>
                </span>
                <span className="text-[11px] text-[color:var(--fg-muted)]">{open ? 'Hide' : 'Show'}</span>
            </button>
            {open && (
                <div className="p-4 space-y-4 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
                    {children}
                </div>
            )}
        </div>
    );
};

const SHAPE_OPTIONS = IMAGE_SHAPES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
}));

const BORDER_STYLE_OPTIONS = IMAGE_BORDER_STYLES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
}));

const MEDIA_TYPE_OPTIONS: Array<{ value: 'image' | 'video'; label: string; icon: React.ReactNode }> = [
    { value: 'image', label: 'Image', icon: <ImageIcon size={14} /> },
    { value: 'video', label: 'Video', icon: <Video size={14} /> },
];

const getAssetHash = (value: string | undefined) => {
    if (!value || !value.startsWith('asset://')) return '';
    return value.slice('asset://'.length);
};

const resolveAssetLabel = (hash: string, assets: AssetsCtx['list']) => {
    if (!hash) return '';
    const meta = assets.find((asset) => asset.hash === hash);
    return meta?.name || '';
};

export function CarouselWidgetSettings({
    values,
    errors,
    locked,
    setFieldValue,
    schemaFields,
    onCommitKeyDown,
    widgetDefaults,
    items,
    assets,
    imageAssets,
    videoAssets,
    onAddSlide,
    onRemoveSlide,
    onMoveSlide,
    onUpdateSlide,
    carouselError,
}: CarouselWidgetSettingsProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ slides: true, behavior: true, typography: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);

    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const previousLabelValue = typeof values.previousLabel === 'string'
        ? values.previousLabel
        : (typeof getDefault('previousLabel') === 'string' ? String(getDefault('previousLabel')) : '');
    const nextLabelValue = typeof values.nextLabel === 'string'
        ? values.nextLabel
        : (typeof getDefault('nextLabel') === 'string' ? String(getDefault('nextLabel')) : '');
    const statusLabelValue = typeof values.statusLabel === 'string'
        ? values.statusLabel
        : (typeof getDefault('statusLabel') === 'string' ? String(getDefault('statusLabel')) : '');

    const backgroundColorValue = typeof values.backgroundColor === 'string'
        ? values.backgroundColor
        : (typeof getDefault('backgroundColor') === 'string' ? String(getDefault('backgroundColor')) : '');
    const backgroundColorSwatch = HEX_COLOR_RE.test(backgroundColorValue) ? backgroundColorValue : '#0f172a';

    const shapeValue = typeof values.shape === 'string' && IMAGE_SHAPES.includes(values.shape as typeof IMAGE_SHAPES[number])
        ? values.shape as typeof IMAGE_SHAPES[number]
        : (typeof getDefault('shape') === 'string' ? getDefault('shape') as typeof IMAGE_SHAPES[number] : 'rectangle');

    const borderStyleValue = typeof values.borderStyle === 'string' && IMAGE_BORDER_STYLES.includes(values.borderStyle as typeof IMAGE_BORDER_STYLES[number])
        ? values.borderStyle as typeof IMAGE_BORDER_STYLES[number]
        : (typeof getDefault('borderStyle') === 'string' ? getDefault('borderStyle') as typeof IMAGE_BORDER_STYLES[number] : 'solid');

    const borderColorDefault = typeof getDefault('borderColor') === 'string' ? String(getDefault('borderColor')) : '#e5e7eb';
    const borderColorValue = typeof values.borderColor === 'string' ? values.borderColor : borderColorDefault;
    const borderColorSwatch = HEX_COLOR_RE.test(borderColorValue) ? borderColorValue : borderColorDefault;

    const borderWidthField = schemaFields.get('borderWidth');
    const borderWidthMeta = borderWidthField instanceof z.ZodNumber ? deriveNumberBounds(borderWidthField as z.ZodNumber) : undefined;
    const minBorderWidth = borderWidthMeta?.min ?? 0;
    const maxBorderWidth = borderWidthMeta?.max ?? 48;
    const borderWidthStep = borderWidthMeta?.step ?? 1;
    const defaultBorderWidth = typeof getDefault('borderWidth') === 'number' ? Number(getDefault('borderWidth')) : 0;
    const customBorderWidth = typeof values.borderWidth === 'number' && Number.isFinite(values.borderWidth);
    const sliderBorderWidth = customBorderWidth ? Number(values.borderWidth) : defaultBorderWidth;
    const borderWidthInputValue = customBorderWidth ? Number(values.borderWidth) : '';

    const radiusField = schemaFields.get('radius');
    const radiusMeta = radiusField instanceof z.ZodNumber ? deriveNumberBounds(radiusField as z.ZodNumber) : undefined;
    const minRadius = radiusMeta?.min ?? 0;
    const maxRadius = radiusMeta?.max ?? 240;
    const radiusStep = radiusMeta?.step ?? 1;
    const defaultRadius = typeof getDefault('radius') === 'number' ? Number(getDefault('radius')) : 12;
    const customRadius = typeof values.radius === 'number' && Number.isFinite(values.radius);
    const sliderRadius = customRadius ? Number(values.radius) : defaultRadius;
    const radiusInputValue = customRadius ? Number(values.radius) : '';

    const intervalField = schemaFields.get('interval');
    const intervalMeta = intervalField instanceof z.ZodNumber ? deriveNumberBounds(intervalField as z.ZodNumber) : undefined;
    const minInterval = intervalMeta?.min ?? 500;
    const maxInterval = intervalMeta?.max ?? 60000;
    const intervalStep = intervalMeta?.step ?? 100;
    const defaultInterval = typeof getDefault('interval') === 'number' ? Number(getDefault('interval')) : 4000;
    const customInterval = typeof values.interval === 'number' && Number.isFinite(values.interval);
    const sliderInterval = customInterval ? Number(values.interval) : defaultInterval;
    const intervalInputValue = customInterval ? Number(values.interval) : '';

    const getBoolean = (key: 'autoPlay' | 'announceSlides', fallback: boolean) => {
        const rawValue = values[key];
        if (typeof rawValue === 'boolean') return rawValue;
        const defaultValue = getDefault(key);
        if (typeof defaultValue === 'boolean') return defaultValue;
        return fallback;
    };

    const autoPlayValue = getBoolean('autoPlay', true);
    const announceSlidesValue = getBoolean('announceSlides', true);

    const slideCards = items.map((slide, index) => {
        const assetHash = getAssetHash(slide.source);
        const assetLabel = assetHash ? resolveAssetLabel(assetHash, assets.list) || `asset://${assetHash}` : (slide.source || 'No source');
        const posterHash = getAssetHash(slide.poster);
        const posterLabel = posterHash ? resolveAssetLabel(posterHash, assets.list) || `asset://${posterHash}` : (slide.poster || 'No poster');
        const isImage = slide.mediaType === 'image';
        return (
            <div key={slide.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">
                        <GripVertical size={14} />
                        <span>Slide {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => onMoveSlide(slide.id, -1)}
                            disabled={locked || index === 0}
                            title="Move up"
                        >
                            <ChevronUp size={12} />
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => onMoveSlide(slide.id, 1)}
                            disabled={locked || index === items.length - 1}
                            title="Move down"
                        >
                            <ChevronDown size={12} />
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs text-red-500"
                            onClick={() => onRemoveSlide(slide.id)}
                            disabled={locked}
                            title="Remove slide"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1 text-xs">Media type</label>
                    <div className="flex flex-wrap gap-2">
                        {MEDIA_TYPE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${slide.mediaType === option.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => onUpdateSlide(slide.id, { mediaType: option.value })}
                                disabled={locked}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1 text-xs">Source</label>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 transition-colors duration-150 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10'}`}>
                            <UploadCloud size={14} />
                            <span>Upload {slide.mediaType}</span>
                            <input
                                type="file"
                                accept={slide.mediaType === 'video' ? 'video/*' : 'image/*'}
                                className="sr-only"
                                disabled={locked}
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.currentTarget.value = '';
                                    if (!file) return;
                                    try {
                                        const metas = await assets.addFiles([file]);
                                        const hash = metas[0]?.hash;
                                        if (hash) onUpdateSlide(slide.id, { source: `asset://${hash}` });
                                    } catch (err) {
                                        console.error('Slide upload failed', err);
                                    }
                                }}
                            />
                        </label>
                        <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]/90">
                            {assetLabel}
                        </span>
                    </div>
                    {isImage && imageAssets.length > 0 && (
                        <select
                            className="input w-full"
                            value={assetHash}
                            onChange={(event) => {
                                const hash = event.target.value;
                                if (hash) onUpdateSlide(slide.id, { source: `asset://${hash}` });
                            }}
                            disabled={locked}
                        >
                            <option value="">Select an image asset…</option>
                            {imageAssets.map((asset) => (
                                <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                            ))}
                        </select>
                    )}
                    {!isImage && videoAssets.length > 0 && (
                        <select
                            className="input w-full"
                            value={assetHash}
                            onChange={(event) => {
                                const hash = event.target.value;
                                if (hash) onUpdateSlide(slide.id, { source: `asset://${hash}` });
                            }}
                            disabled={locked}
                        >
                            <option value="">Select a video asset…</option>
                            {videoAssets.map((asset) => (
                                <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                            ))}
                        </select>
                    )}
                    <input
                        className="input w-full font-mono text-xs"
                        value={slide.source}
                        placeholder={isImage ? 'asset://hash or https://example.com/image.jpg' : 'asset://hash or https://example.com/video.mp4'}
                        onChange={(event) => onUpdateSlide(slide.id, { source: event.target.value })}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                    />
                </div>
                {isImage ? (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1 text-xs">Alt text</label>
                        <input
                            className="input w-full"
                            value={slide.alt}
                            onChange={(event) => onUpdateSlide(slide.id, { alt: event.target.value })}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                            placeholder="Describe the image"
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label className="block text-[color:var(--fg-muted)] mb-1 text-xs">Poster image</label>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 transition-colors duration-150 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10'}`}>
                                <UploadCloud size={14} />
                                <span>Upload image</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    disabled={locked}
                                    onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        event.currentTarget.value = '';
                                        if (!file) return;
                                        try {
                                            const metas = await assets.addFiles([file]);
                                            const hash = metas[0]?.hash;
                                            if (hash) onUpdateSlide(slide.id, { poster: `asset://${hash}` });
                                        } catch (err) {
                                            console.error('Poster upload failed', err);
                                        }
                                    }}
                                />
                            </label>
                            <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]/90">
                                {posterLabel}
                            </span>
                        </div>
                        {imageAssets.length > 0 && (
                            <select
                                className="input w-full"
                                value={posterHash}
                                onChange={(event) => {
                                    const hash = event.target.value;
                                    if (hash) onUpdateSlide(slide.id, { poster: `asset://${hash}` });
                                }}
                                disabled={locked}
                            >
                                <option value="">Select an image asset…</option>
                                {imageAssets.map((asset) => (
                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                ))}
                            </select>
                        )}
                        <input
                            className="input w-full font-mono text-xs"
                            value={slide.poster || ''}
                            placeholder="asset://hash or https://example.com/poster.jpg"
                            onChange={(event) => onUpdateSlide(slide.id, { poster: event.target.value })}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                    </div>
                )}
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1 text-xs">Caption</label>
                    <input
                        className="input w-full"
                        value={slide.caption}
                        onChange={(event) => onUpdateSlide(slide.id, { caption: event.target.value })}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                        placeholder="Optional description displayed on top of the media"
                    />
                </div>
            </div>
        );
    });

    const slidesEmptyState = !items.length ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/20 p-6 text-center text-sm text-[color:var(--fg-muted)]">
            Add at least one slide with an image or video source to render the carousel.
        </div>
    ) : null;

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="slides" title="Slides & media" icon={<Images size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-[color:var(--fg-muted)] text-sm">Reorder, upload, or link slides. Each entry becomes a frame in the carousel.</div>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={onAddSlide} disabled={locked}>
                        Add slide
                    </button>
                </div>
                {slidesEmptyState}
                <div className="space-y-3">
                    {slideCards}
                </div>
                {carouselError && <div className="text-xs text-red-500">{carouselError}</div>}
            </SectionCard>

            <SectionCard sectionKey="behavior" title="Playback & timing" icon={<Timer size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        className={`w-full px-3 py-2 rounded border text-left text-sm font-semibold transition-colors duration-150 ${autoPlayValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                        onClick={() => setFieldValue('autoPlay', !autoPlayValue)}
                        disabled={locked}
                    >
                        Auto-play slides
                        <div className="text-[11px] text-[color:var(--fg-muted)]/90">Cycle through slides automatically.</div>
                    </button>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-3 space-y-3">
                        <div className="flex items-center justify-between text-xs text-[color:var(--fg-muted)]">
                            <span>Interval ({sliderInterval}ms)</span>
                            <span>{autoPlayValue ? 'Active' : 'Paused'}</span>
                        </div>
                        <input
                            type="range"
                            className="w-full accent-[color:var(--accent)]"
                            min={minInterval}
                            max={maxInterval}
                            step={intervalStep}
                            value={sliderInterval}
                            onChange={(event) => setFieldValue('interval', Number(event.target.value))}
                            disabled={locked || !autoPlayValue}
                        />
                        <div className="flex items-center gap-2">
                            <input
                                className="input w-28"
                                type="number"
                                min={minInterval}
                                max={maxInterval}
                                step={intervalStep}
                                value={intervalInputValue}
                                placeholder={`${minInterval}-${maxInterval}`}
                                onChange={(event) => {
                                    const raw = event.target.value;
                                    setFieldValue('interval', raw === '' ? undefined : Number(raw));
                                }}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked || !autoPlayValue}
                            />
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold"
                                onClick={() => setFieldValue('interval', undefined)}
                                disabled={locked || !customInterval}
                            >
                                Auto
                            </button>
                        </div>
                        {errors.interval && <div className="text-xs text-red-500">{errors.interval}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<Palette size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Background color</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={backgroundColorSwatch}
                            onChange={(event) => setFieldValue('backgroundColor', event.target.value)}
                            disabled={locked}
                            aria-label="Carousel background color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={backgroundColorValue}
                            placeholder="var(--surface)"
                            onChange={(event) => setFieldValue('backgroundColor', event.target.value)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold"
                            onClick={() => setFieldValue('backgroundColor', undefined)}
                            disabled={locked || !backgroundColorValue}
                        >
                            Reset
                        </button>
                    </div>
                    {errors.backgroundColor && <div className="text-xs text-red-500 mt-1">{errors.backgroundColor}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Shape</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {SHAPE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${shapeValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                onClick={() => setFieldValue('shape', option.value)}
                                disabled={locked}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {errors.shape && <div className="text-xs text-red-500 mt-1">{errors.shape}</div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Frame radius</label>
                        <input
                            type="range"
                            className="w-full accent-[color:var(--accent)]"
                            min={minRadius}
                            max={maxRadius}
                            step={radiusStep}
                            value={sliderRadius}
                            onChange={(event) => setFieldValue('radius', Number(event.target.value))}
                            disabled={locked}
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                className="input w-24"
                                type="number"
                                min={minRadius}
                                max={maxRadius}
                                step={radiusStep}
                                value={radiusInputValue}
                                placeholder={`${minRadius}-${maxRadius}`}
                                onChange={(event) => {
                                    const raw = event.target.value;
                                    setFieldValue('radius', raw === '' ? undefined : Number(raw));
                                }}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold"
                                onClick={() => setFieldValue('radius', undefined)}
                                disabled={locked || !customRadius}
                            >
                                Auto
                            </button>
                        </div>
                        {errors.radius && <div className="text-xs text-red-500 mt-1">{errors.radius}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Border width</label>
                        <input
                            type="range"
                            className="w-full accent-[color:var(--accent)]"
                            min={minBorderWidth}
                            max={maxBorderWidth}
                            step={borderWidthStep}
                            value={sliderBorderWidth}
                            onChange={(event) => setFieldValue('borderWidth', Number(event.target.value))}
                            disabled={locked}
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                className="input w-24"
                                type="number"
                                min={minBorderWidth}
                                max={maxBorderWidth}
                                step={borderWidthStep}
                                value={borderWidthInputValue}
                                placeholder={`${minBorderWidth}-${maxBorderWidth}`}
                                onChange={(event) => {
                                    const raw = event.target.value;
                                    setFieldValue('borderWidth', raw === '' ? undefined : Number(raw));
                                }}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold"
                                onClick={() => setFieldValue('borderWidth', undefined)}
                                disabled={locked || !customBorderWidth}
                            >
                                Auto
                            </button>
                        </div>
                        {errors.borderWidth && <div className="text-xs text-red-500 mt-1">{errors.borderWidth}</div>}
                    </div>
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Border style</label>
                    <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {BORDER_STYLE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${borderStyleValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                    onClick={() => setFieldValue('borderStyle', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span>{option.label}</span>
                                        <span className="flex-1 h-px border-t border-current" style={{ borderStyle: option.value }} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    {errors.borderStyle && <div className="text-xs text-red-500 mt-1">{errors.borderStyle}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Border color</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={borderColorSwatch}
                            onChange={(event) => setFieldValue('borderColor', event.target.value)}
                            disabled={locked}
                            aria-label="Border color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={borderColorValue}
                            onChange={(event) => setFieldValue('borderColor', event.target.value)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="#e5e7eb"
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold"
                            onClick={() => setFieldValue('borderColor', undefined)}
                            disabled={locked || borderColorValue === borderColorDefault}
                        >
                            Reset
                        </button>
                    </div>
                    {errors.borderColor && <div className="text-xs text-red-500 mt-1">{errors.borderColor}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Unlock size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                        <input
                            className="input w-full"
                            value={ariaLabelValue}
                            onChange={(event) => setFieldValue('ariaLabel', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Media carousel"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Provide a short description of what the carousel shows.</div>
                        {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                        <textarea
                            className="input w-full min-h-[4rem]"
                            value={ariaDescriptionValue}
                            onChange={(event) => setFieldValue('ariaDescription', event.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Explain available controls or gestures.</div>
                        {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Previous label</label>
                        <input
                            className="input w-full"
                            value={previousLabelValue}
                            onChange={(event) => setFieldValue('previousLabel', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        {errors.previousLabel && <div className="text-xs text-red-500 mt-1">{errors.previousLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Next label</label>
                        <input
                            className="input w-full"
                            value={nextLabelValue}
                            onChange={(event) => setFieldValue('nextLabel', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        {errors.nextLabel && <div className="text-xs text-red-500 mt-1">{errors.nextLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Status pattern</label>
                        <input
                            className="input w-full"
                            value={statusLabelValue}
                            onChange={(event) => setFieldValue('statusLabel', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Slide {current} of {total}"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Use {"{current}"} and {"{total}"} tokens.</div>
                        {errors.statusLabel && <div className="text-xs text-red-500 mt-1">{errors.statusLabel}</div>}
                    </div>
                </div>
                <button
                    type="button"
                    className={`w-full px-3 py-2 rounded border text-left text-sm font-semibold transition-colors duration-150 ${announceSlidesValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                    onClick={() => setFieldValue('announceSlides', !announceSlidesValue)}
                    disabled={locked}
                >
                    Live status announcements
                    <div className="text-[11px] text-[color:var(--fg-muted)]/90">Screen readers announce slide changes when enabled.</div>
                </button>
            </SectionCard>
        </div>
    );
}
