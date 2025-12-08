import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, SlidersHorizontal, Sparkles } from 'lucide-react';
import { z } from 'zod';

import { useAssets } from '../../providers/AssetsProvider';
import { useNotifications } from '../../providers/NotificationsProvider';
import { useProjects } from '../../providers/ProjectsProvider';

import {
    deriveNumberBounds,
    HEX_COLOR_RE,
    IMAGE_BORDER_STYLES,
    IMAGE_SHAPES,
    isImageBorderStyleValue,
    isImageFitValue,
    isImageShapeValue,
    type ImageBorderStyleOption,
    type ImageFitOption,
    type ImageShapeOption,
} from './shared';
import type { WidgetSettingsComponentProps } from './types';

const FIT_OPTIONS: Array<{ value: ImageFitOption; label: string; description: string }> = [
    { value: 'contain', label: 'Contain', description: 'Show the entire image with potential letterboxing.' },
    { value: 'cover', label: 'Cover', description: 'Fill the frame while cropping overflow.' },
    { value: 'fill', label: 'Stretch', description: 'Fill the frame without preserving aspect ratio.' },
    { value: 'scale-down', label: 'Scale down', description: 'Shrink large images but never upscale.' },
    { value: 'none', label: 'Original', description: 'Use intrinsic size (may overflow).' },
];

const BORDER_STYLE_OPTIONS: Array<{ value: ImageBorderStyleOption; label: string }> = IMAGE_BORDER_STYLES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
}));

type SectionKey = 'content' | 'typography' | 'accessibility';

const SectionCard = ({
    sectionKey,
    title,
    icon,
    children,
    sectionsOpen,
    toggleSection,
}: {
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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]"
                onClick={() => toggleSection(sectionKey)}
                aria-expanded={open}
            >
                <span className="flex items-center gap-2 text-[color:var(--fg)]">
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="flex items-center gap-2 text-[color:var(--fg)]">
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

type ImageWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
};

const ALT_CHAR_LIMIT = 160;
const ARIA_DESCRIPTION_CHAR_LIMIT = 320;

export function ImageWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: ImageWidgetSettingsProps) {
    const assets = useAssets();
    const { add: notify } = useNotifications();
    const { selectedProject } = useProjects();

    const imageAssets = useMemo(
        () => assets.list.filter((asset) => {
            if (asset.type?.startsWith('image/')) return true;
            const hasDimensions = typeof asset.width === 'number' && asset.width > 0 && typeof asset.height === 'number' && asset.height > 0;
            return hasDimensions;
        }),
        [assets.list],
    );

    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ content: true, typography: true, accessibility: true });
    const [uploadedLabel, setUploadedLabel] = useState('');

    const toggleSection = (key: SectionKey) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);
    const srcValue = typeof values.src === 'string' ? values.src : (typeof getDefault('src') === 'string' ? String(getDefault('src')) : '');
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const altValue = typeof values.alt === 'string' ? values.alt : (typeof getDefault('alt') === 'string' ? String(getDefault('alt')) : 'Image');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const altCharCount = altValue.length;
    const fitValue = isImageFitValue(values.fit) ? values.fit : (isImageFitValue(getDefault('fit')) ? (getDefault('fit') as ImageFitOption) : 'contain');
    const shapeValue = isImageShapeValue(values.shape) ? values.shape : (isImageShapeValue(getDefault('shape')) ? (getDefault('shape') as ImageShapeOption) : 'rectangle');
    const borderStyleValue = isImageBorderStyleValue(values.borderStyle)
        ? values.borderStyle
        : (isImageBorderStyleValue(getDefault('borderStyle')) ? (getDefault('borderStyle') as ImageBorderStyleOption) : 'solid');

    const scaleField = schemaFields.get('scale');
    const scaleMeta = scaleField instanceof z.ZodNumber ? deriveNumberBounds(scaleField as z.ZodNumber) : undefined;
    const minScale = scaleMeta?.min ?? 0.1;
    const maxScale = scaleMeta?.max ?? 4;
    const scaleStep = scaleMeta?.step ?? 0.05;
    const defaultScale = typeof getDefault('scale') === 'number' ? Number(getDefault('scale')) : 1;
    const customScale = typeof values.scale === 'number' && Number.isFinite(values.scale);
    const sliderScale = customScale ? Number(values.scale) : defaultScale;
    const scaleInputValue = customScale ? Number(values.scale) : '';

    const radiusField = schemaFields.get('radius');
    const radiusMeta = radiusField instanceof z.ZodNumber ? deriveNumberBounds(radiusField as z.ZodNumber) : undefined;
    const minRadius = radiusMeta?.min ?? 0;
    const maxRadius = radiusMeta?.max ?? 240;
    const defaultRadius = typeof getDefault('radius') === 'number' ? Number(getDefault('radius')) : 8;
    const customRadius = typeof values.radius === 'number' && Number.isFinite(values.radius);
    const sliderRadius = customRadius ? Number(values.radius) : defaultRadius;
    const radiusInputValue = customRadius ? Number(values.radius) : '';

    const borderWidthField = schemaFields.get('borderWidth');
    const borderWidthMeta = borderWidthField instanceof z.ZodNumber ? deriveNumberBounds(borderWidthField as z.ZodNumber) : undefined;
    const minBorderWidth = borderWidthMeta?.min ?? 0;
    const maxBorderWidth = borderWidthMeta?.max ?? 48;
    const defaultBorderWidth = typeof getDefault('borderWidth') === 'number' ? Number(getDefault('borderWidth')) : 0;
    const customBorderWidth = typeof values.borderWidth === 'number' && Number.isFinite(values.borderWidth);
    const sliderBorderWidth = customBorderWidth ? Number(values.borderWidth) : defaultBorderWidth;
    const borderWidthInputValue = customBorderWidth ? Number(values.borderWidth) : '';

    const borderColorDefault = typeof getDefault('borderColor') === 'string' ? String(getDefault('borderColor')) : '#000000';
    const borderColorValue = typeof values.borderColor === 'string' ? values.borderColor : borderColorDefault;
    const borderColorSwatch = HEX_COLOR_RE.test(borderColorValue) ? borderColorValue : '#000000';

    const assetSelectValue = srcValue.startsWith('asset://') ? srcValue.slice('asset://'.length) : '';

    useEffect(() => {
        let alive = true;
        async function resolveLabel() {
            if (!srcValue || !srcValue.startsWith('asset://')) {
                if (alive) setUploadedLabel('');
                return;
            }
            const hash = srcValue.slice('asset://'.length);
            try {
                const meta = await assets.get(hash);
                if (alive) setUploadedLabel(meta?.name || '');
            } catch {
                if (alive) setUploadedLabel('');
            }
        }
        void resolveLabel();
        return () => { alive = false; };
    }, [srcValue, assets]);

    const handleFileUpload = async (file: File | undefined) => {
        if (!file) {
            setUploadedLabel('');
            return;
        }
        setUploadedLabel(file.name);
        try {
            const metas = await assets.addFiles([file]);
            const meta = metas[0];
            if (meta?.hash) {
                setFieldValue('src', `asset://${meta.hash}`);
            }
        } catch (err) {
            console.error('Image upload failed', err);
            try {
                notify({ type: 'error', message: `Failed to upload ${file.name}`, title: selectedProject?.name || 'Editor', persistent: false });
            } catch {
                /* noop */
            }
            setUploadedLabel('');
        }
    };

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="content" title="Image content" icon={<ImageIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label
                            className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 transition-colors duration-150 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10'}`}
                        >
                            <span className="font-semibold">Upload image</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={locked}
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    await handleFileUpload(file);
                                }}
                            />
                        </label>
                        <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${uploadedLabel ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                            {uploadedLabel || 'No file chosen'}
                        </span>
                    </div>
                    {imageAssets.length > 0 && (
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Pick from assets</label>
                            <select
                                className="input w-full"
                                disabled={locked}
                                value={assetSelectValue}
                                onChange={async (event) => {
                                    const hash = event.target.value;
                                    if (!hash) {
                                        setFieldValue('src', '');
                                        setUploadedLabel('');
                                        return;
                                    }
                                    setFieldValue('src', `asset://${hash}`);
                                    try {
                                        const meta = await assets.get(hash);
                                        setUploadedLabel(meta?.name || '');
                                    } catch {
                                        setUploadedLabel('');
                                    }
                                }}
                            >
                                <option value="">Select an uploaded asset…</option>
                                {imageAssets.map((asset) => (
                                    <option key={asset.hash} value={asset.hash}>
                                        {asset.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Image URL or asset reference *</label>
                        <input
                            className="input w-full font-mono text-xs"
                            value={srcValue}
                            onChange={(e) => setFieldValue('src', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="https://example.com/photo.jpg or asset://hash"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Accepts https:// links, data URLs, or asset:// references.</div>
                        {errors.src && <div className="text-xs text-red-500 mt-1">{errors.src}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<SlidersHorizontal size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-5">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Object fit</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {FIT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`text-left px-3 py-2 rounded border text-xs font-semibold transition-colors duration-150 ${fitValue === option.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('fit', option.value)}
                                    disabled={locked}
                                >
                                    <div className="text-sm font-semibold">{option.label}</div>
                                    <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                                </button>
                            ))}
                        </div>
                        {errors.fit && <div className="text-xs text-red-500 mt-1">{errors.fit}</div>}
                    </div>

                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Scale</label>
                        <input
                            type="range"
                            className="w-full accent-[color:var(--accent)]"
                            min={minScale}
                            max={maxScale}
                            step={scaleStep}
                            value={sliderScale}
                            onChange={(e) => setFieldValue('scale', Number(e.target.value))}
                            disabled={locked}
                        />
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <input
                                className="input w-24"
                                type="number"
                                min={minScale}
                                max={maxScale}
                                step={scaleStep}
                                value={scaleInputValue}
                                placeholder={`${minScale}-${maxScale}`}
                                onChange={(e) => setFieldValue('scale', e.target.value === '' ? undefined : Number(e.target.value))}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                onClick={() => setFieldValue('scale', undefined)}
                                disabled={locked || !customScale}
                            >
                                Auto
                            </button>
                            <div className="text-[11px] text-[color:var(--fg-muted)]">{customScale ? `${sliderScale.toFixed(2)}×` : `Defaults to ${defaultScale}×`}</div>
                        </div>
                        {errors.scale && <div className="text-xs text-red-500 mt-1">{errors.scale}</div>}
                    </div>

                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Shape</label>
                        <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {IMAGE_SHAPES.map((shape) => (
                                    <button
                                        key={shape}
                                        type="button"
                                        className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${shapeValue === shape ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                        onClick={() => setFieldValue('shape', shape)}
                                        disabled={locked}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span>{shape === 'rounded' ? 'Rounded' : shape.charAt(0).toUpperCase() + shape.slice(1)}</span>
                                            <span
                                                className="inline-block h-6 w-10 border border-white/70"
                                                style={{
                                                    borderRadius: shape === 'circle' ? '999px' : shape === 'rounded' ? '12px' : '2px',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                }}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {errors.shape && <div className="text-xs text-red-500 mt-1">{errors.shape}</div>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Corner radius (px)</label>
                            <input
                                type="range"
                                className="w-full accent-[color:var(--accent)]"
                                min={minRadius}
                                max={maxRadius}
                                step={1}
                                value={sliderRadius}
                                onChange={(event) => setFieldValue('radius', Number(event.target.value))}
                                disabled={locked || shapeValue !== 'rounded'}
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <input
                                    className="input w-24"
                                    type="number"
                                    min={minRadius}
                                    max={maxRadius}
                                    step={1}
                                    value={radiusInputValue}
                                    placeholder={`${minRadius}-${maxRadius}`}
                                    onChange={(event) => setFieldValue('radius', event.target.value === '' ? undefined : Number(event.target.value))}
                                    onKeyDown={onCommitKeyDown}
                                    disabled={locked || shapeValue !== 'rounded'}
                                />
                                <button
                                    type="button"
                                    className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                    onClick={() => setFieldValue('radius', undefined)}
                                    disabled={locked || !customRadius}
                                >
                                    Auto
                                </button>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">
                                    {shapeValue !== 'rounded' ? 'Rounded shape only' : customRadius ? `${sliderRadius}px` : `Defaults to ${defaultRadius}px`}
                                </div>
                            </div>
                            {errors.radius && <div className="text-xs text-red-500 mt-1">{errors.radius}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Border width (px)</label>
                            <input
                                type="range"
                                className="w-full accent-[color:var(--accent)]"
                                min={minBorderWidth}
                                max={maxBorderWidth}
                                step={1}
                                value={sliderBorderWidth}
                                onChange={(event) => setFieldValue('borderWidth', Number(event.target.value))}
                                disabled={locked}
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <input
                                    className="input w-24"
                                    type="number"
                                    min={minBorderWidth}
                                    max={maxBorderWidth}
                                    step={1}
                                    value={borderWidthInputValue}
                                    placeholder={`${minBorderWidth}-${maxBorderWidth}`}
                                    onChange={(event) => setFieldValue('borderWidth', event.target.value === '' ? undefined : Number(event.target.value))}
                                    onKeyDown={onCommitKeyDown}
                                    disabled={locked}
                                />
                                <button
                                    type="button"
                                    className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                    onClick={() => setFieldValue('borderWidth', undefined)}
                                    disabled={locked || !customBorderWidth}
                                >
                                    Auto
                                </button>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">{customBorderWidth ? `${sliderBorderWidth}px` : `Defaults to ${defaultBorderWidth}px`}</div>
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
                                            <span
                                                className="flex-1 h-px border-t border-current"
                                                style={{ borderStyle: option.value }}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {errors.borderStyle && <div className="text-xs text-red-500 mt-1">{errors.borderStyle}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1 mt-4">Border color</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="color"
                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                value={borderColorSwatch}
                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                disabled={locked}
                                aria-label="Border color"
                            />
                            <input
                                className="input flex-1 font-mono text-xs"
                                value={borderColorValue}
                                onChange={(e) => setFieldValue('borderColor', e.target.value)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="#000000"
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                onClick={() => setFieldValue('borderColor', undefined)}
                                disabled={locked || borderColorValue === borderColorDefault}
                            >
                                Reset
                            </button>
                        </div>
                        {errors.borderColor && <div className="text-xs text-red-500 mt-1">{errors.borderColor}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Sparkles size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                        <input
                            className="input w-full"
                            value={ariaLabelValue}
                            onChange={(event) => setFieldValue('ariaLabel', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Override the spoken label"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave empty to derive the label from the widget name.</div>
                        {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                        <textarea
                            className="input w-full min-h-[4.5rem]"
                            value={ariaDescriptionValue}
                            onChange={(event) => setFieldValue('ariaDescription', event.target.value ? event.target.value : undefined)}
                            onKeyDown={onCommitKeyDown}
                            maxLength={ARIA_DESCRIPTION_CHAR_LIMIT}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                            <span>
                            </span>
                            <span>Optional extra detail for charts or text-heavy graphics.</span>
                        </div>
                        {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                    </div>
                </div>
                <div className="mt-4 space-y-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Alt text *</label>
                        <input
                            className="input w-full"
                            value={altValue}
                            onChange={(event) => setFieldValue('alt', event.target.value)}
                            onKeyDown={onCommitKeyDown}
                            maxLength={ALT_CHAR_LIMIT}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                            <span>
                                {altCharCount}/{ALT_CHAR_LIMIT} characters
                            </span>
                            <span>Give a concise literal description of the image.</span>
                        </div>
                        {errors.alt && <div className="text-xs text-red-500 mt-1">{errors.alt}</div>}
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)]">
                        Screen readers announce the aria label first, then alt text, and finally the aria description when present.
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
