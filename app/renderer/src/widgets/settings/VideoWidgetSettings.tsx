import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clapperboard, Image as ImageIcon, PlayCircle, Palette, Sparkles } from 'lucide-react';
import { z } from 'zod';

import { useAssets } from '../../providers/AssetsProvider';
import { useNotifications } from '../../providers/NotificationsProvider';
import { useProjects } from '../../providers/ProjectsProvider';

import {
    deriveNumberBounds,
    HEX_COLOR_RE,
    VIDEO_BORDER_STYLES,
    VIDEO_SHAPES,
    isVideoBorderStyleValue,
    isVideoShapeValue,
    type VideoBorderStyleOption,
    type VideoShapeOption,
} from './shared';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'source' | 'poster' | 'playback' | 'typography' | 'accessibility';

type VideoWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
};

type BooleanField = 'autoplay' | 'muted' | 'loop' | 'controls' | 'playsInline' | 'allowFullscreen';

const BORDER_STYLE_OPTIONS: Array<{ value: VideoBorderStyleOption; label: string }> = VIDEO_BORDER_STYLES.map((style) => ({
    value: style,
    label: style.charAt(0).toUpperCase() + style.slice(1),
}));

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

export function VideoWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: VideoWidgetSettingsProps) {
    const assets = useAssets();
    const { add: notify } = useNotifications();
    const { selectedProject } = useProjects();
    const videoAssets = useMemo(() => assets.list.filter((asset) => asset.type?.startsWith('video/')), [assets.list]);
    const imageAssets = useMemo(() => assets.list.filter((asset) => {
        if (asset.type?.startsWith('image/')) return true;
        const hasDimensions = typeof asset.width === 'number' && asset.width > 0 && typeof asset.height === 'number' && asset.height > 0;
        return hasDimensions;
    }), [assets.list]);
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ source: true, poster: true, playback: true, typography: true, accessibility: true });
    const [videoLabel, setVideoLabel] = useState('');
    const [posterLabel, setPosterLabel] = useState('');

    const toggleSection = (key: SectionKey) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);

    const srcValue = typeof values.src === 'string'
        ? values.src
        : (typeof getDefault('src') === 'string' ? String(getDefault('src')) : '');
    const posterValue = typeof values.poster === 'string'
        ? values.poster
        : (typeof getDefault('poster') === 'string' ? String(getDefault('poster')) : '');
    const titleValue = typeof values.title === 'string'
        ? values.title
        : (typeof getDefault('title') === 'string' ? String(getDefault('title')) : '');
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const fallbackTextValue = typeof values.fallbackText === 'string'
        ? values.fallbackText
        : (typeof getDefault('fallbackText') === 'string' ? String(getDefault('fallbackText')) : '');

    const backgroundColorValue = typeof values.backgroundColor === 'string'
        ? values.backgroundColor
        : (typeof getDefault('backgroundColor') === 'string' ? String(getDefault('backgroundColor')) : '');
    const backgroundColorSwatch = HEX_COLOR_RE.test(backgroundColorValue) ? backgroundColorValue : '#000000';

    const shapeValue = isVideoShapeValue(values.shape)
        ? values.shape
        : (isVideoShapeValue(getDefault('shape')) ? getDefault('shape') as VideoShapeOption : 'rectangle');

    const borderStyleValue = isVideoBorderStyleValue(values.borderStyle)
        ? values.borderStyle
        : (isVideoBorderStyleValue(getDefault('borderStyle')) ? getDefault('borderStyle') as VideoBorderStyleOption : 'solid');

    const borderWidthField = schemaFields.get('borderWidth');
    const borderWidthMeta = borderWidthField instanceof z.ZodNumber ? deriveNumberBounds(borderWidthField as z.ZodNumber) : undefined;
    const minBorderWidth = borderWidthMeta?.min ?? 0;
    const maxBorderWidth = borderWidthMeta?.max ?? 48;
    const borderWidthStep = borderWidthMeta?.step ?? 1;
    const defaultBorderWidth = typeof getDefault('borderWidth') === 'number' ? Number(getDefault('borderWidth')) : 0;
    const customBorderWidth = typeof values.borderWidth === 'number' && Number.isFinite(values.borderWidth);
    const sliderBorderWidth = customBorderWidth ? Number(values.borderWidth) : defaultBorderWidth;
    const borderWidthInputValue = customBorderWidth ? Number(values.borderWidth) : '';

    const borderRadiusField = schemaFields.get('borderRadius');
    const borderRadiusMeta = borderRadiusField instanceof z.ZodNumber ? deriveNumberBounds(borderRadiusField as z.ZodNumber) : undefined;
    const minBorderRadius = borderRadiusMeta?.min ?? 0;
    const maxBorderRadius = borderRadiusMeta?.max ?? 240;
    const borderRadiusStep = borderRadiusMeta?.step ?? 1;
    const defaultBorderRadius = typeof getDefault('borderRadius') === 'number' ? Number(getDefault('borderRadius')) : 8;
    const customBorderRadius = typeof values.borderRadius === 'number' && Number.isFinite(values.borderRadius);
    const sliderBorderRadius = customBorderRadius ? Number(values.borderRadius) : defaultBorderRadius;
    const borderRadiusInputValue = customBorderRadius ? Number(values.borderRadius) : '';

    const borderColorDefault = typeof getDefault('borderColor') === 'string' ? String(getDefault('borderColor')) : '#e5e7eb';
    const borderColorValue = typeof values.borderColor === 'string' ? values.borderColor : borderColorDefault;
    const borderColorSwatch = HEX_COLOR_RE.test(borderColorValue) ? borderColorValue : '#e5e7eb';

    const videoAssetSelectValue = srcValue.startsWith('asset://') ? srcValue.slice('asset://'.length) : '';
    const posterAssetSelectValue = posterValue.startsWith('asset://') ? posterValue.slice('asset://'.length) : '';

    const getBooleanValue = (key: BooleanField, fallback = false) => {
        const rawValue = values[key];
        if (typeof rawValue === 'boolean') return rawValue;
        const defaultValue = getDefault(key);
        if (typeof defaultValue === 'boolean') return defaultValue;
        return fallback;
    };

    const autoplayValue = getBooleanValue('autoplay', false);
    const mutedValue = getBooleanValue('muted', true);
    const loopValue = getBooleanValue('loop', false);
    const controlsValue = getBooleanValue('controls', true);
    const playsInlineValue = getBooleanValue('playsInline', true);
    const fullscreenValue = getBooleanValue('allowFullscreen', true);

    useEffect(() => {
        let alive = true;
        async function resolveVideoLabel() {
            if (!srcValue || !srcValue.startsWith('asset://')) { if (alive) setVideoLabel(''); return; }
            const hash = srcValue.slice('asset://'.length);
            try {
                const meta = await assets.get(hash);
                if (alive) setVideoLabel(meta?.name || '');
            } catch {
                if (alive) setVideoLabel('');
            }
        }
        void resolveVideoLabel();
        return () => { alive = false; };
    }, [assets, srcValue]);

    useEffect(() => {
        let alive = true;
        async function resolvePosterLabel() {
            if (!posterValue || !posterValue.startsWith('asset://')) { if (alive) setPosterLabel(''); return; }
            const hash = posterValue.slice('asset://'.length);
            try {
                const meta = await assets.get(hash);
                if (alive) setPosterLabel(meta?.name || '');
            } catch {
                if (alive) setPosterLabel('');
            }
        }
        void resolvePosterLabel();
        return () => { alive = false; };
    }, [assets, posterValue]);

    const handleVideoUpload = async (file: File | undefined) => {
        if (!file) { setVideoLabel(''); return; }
        setVideoLabel(file.name);
        try {
            const metas = await assets.addFiles([file]);
            const meta = metas[0];
            if (meta?.hash) {
                setFieldValue('src', `asset://${meta.hash}`);
            }
        } catch (err) {
            console.error('Video upload failed', err);
            try {
                notify({ type: 'error', message: `Failed to upload ${file.name}`, title: selectedProject?.name || 'Editor', persistent: false });
            } catch { /* noop */ }
            setVideoLabel('');
        }
    };

    const handlePosterUpload = async (file: File | undefined) => {
        if (!file) { setPosterLabel(''); return; }
        setPosterLabel(file.name);
        try {
            const metas = await assets.addFiles([file]);
            const meta = metas[0];
            if (meta?.hash) {
                setFieldValue('poster', `asset://${meta.hash}`);
            }
        } catch (err) {
            console.error('Poster upload failed', err);
            try {
                notify({ type: 'error', message: `Failed to upload ${file.name}`, title: selectedProject?.name || 'Editor', persistent: false });
            } catch { /* noop */ }
            setPosterLabel('');
        }
    };

    const playbackToggles: Array<{ key: BooleanField; label: string; description: string; value: boolean }> = [
        { key: 'autoplay', label: 'Autoplay', description: 'Start playing on load (muted only).', value: autoplayValue },
        { key: 'muted', label: 'Muted', description: 'Required by browsers for autoplay.', value: mutedValue },
        { key: 'loop', label: 'Loop', description: 'Restart automatically when finished.', value: loopValue },
        { key: 'controls', label: 'Player controls', description: 'Show play/pause UI.', value: controlsValue },
        { key: 'playsInline', label: 'Inline playback', description: 'Avoid forcing full-screen on mobile Safari.', value: playsInlineValue },
        { key: 'allowFullscreen', label: 'Allow fullscreen', description: 'Let viewers pop the player out.', value: fullscreenValue },
    ];

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="source" title="Video source & metadata" icon={<Clapperboard size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 transition-colors duration-150 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10'}`}>
                            <span className="font-semibold">Upload video</span>
                            <input
                                type="file"
                                accept="video/*"
                                className="sr-only"
                                disabled={locked}
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    await handleVideoUpload(file);
                                }}
                            />
                        </label>
                        <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${videoLabel ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                            {videoLabel || 'No file chosen'}
                        </span>
                    </div>
                    {videoAssets.length > 0 && (
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Pick from assets</label>
                            <select
                                className="input w-full"
                                value={videoAssetSelectValue}
                                onChange={async (event) => {
                                    const hash = event.target.value;
                                    if (!hash) {
                                        setFieldValue('src', '');
                                        setVideoLabel('');
                                        return;
                                    }
                                    setFieldValue('src', `asset://${hash}`);
                                    try {
                                        const meta = await assets.get(hash);
                                        setVideoLabel(meta?.name || '');
                                    } catch {
                                        setVideoLabel('');
                                    }
                                }}
                                disabled={locked}
                            >
                                <option value="">Select a video asset…</option>
                                {videoAssets.map((asset) => (
                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Video URL or asset reference *</label>
                        <input
                            className="input w-full font-mono text-xs"
                            value={srcValue}
                            onChange={(event) => setFieldValue('src', event.target.value)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="https://youtu.be/... or asset://hash"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Accepts YouTube links, mp4/stream URLs, data/blob sources, or asset:// identifiers.</div>
                        {errors.src && <div className="text-xs text-red-500 mt-1">{errors.src}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="poster" title="Poster & fallback" icon={<ImageIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 transition-colors duration-150 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10'}`}>
                            <span className="font-semibold">Upload poster</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={locked}
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    await handlePosterUpload(file);
                                }}
                            />
                        </label>
                        <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${posterLabel ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                            {posterLabel || 'No file chosen'}
                        </span>
                    </div>
                    {imageAssets.length > 0 && (
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Pick from assets</label>
                            <select
                                className="input w-full"
                                value={posterAssetSelectValue}
                                onChange={async (event) => {
                                    const hash = event.target.value;
                                    if (!hash) {
                                        setFieldValue('poster', undefined);
                                        setPosterLabel('');
                                        return;
                                    }
                                    setFieldValue('poster', `asset://${hash}`);
                                    try {
                                        const meta = await assets.get(hash);
                                        setPosterLabel(meta?.name || '');
                                    } catch {
                                        setPosterLabel('');
                                    }
                                }}
                                disabled={locked}
                            >
                                <option value="">Select an image asset…</option>
                                {imageAssets.map((asset) => (
                                    <option key={asset.hash} value={asset.hash}>{asset.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Poster URL or asset reference</label>
                        <input
                            className="input w-full font-mono text-xs"
                            value={posterValue}
                            onChange={(event) => setFieldValue('poster', event.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="asset://hash or https://example.com/poster.jpg"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Shown before playback begins or while resolving assets.</div>
                        {errors.poster && <div className="text-xs text-red-500 mt-1">{errors.poster}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Fallback message</label>
                        <textarea
                            className="input w-full min-h-[4.5rem]"
                            value={fallbackTextValue}
                            onChange={(event) => setFieldValue('fallbackText', event.target.value)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Displayed if the video cannot be loaded.</div>
                        {errors.fallbackText && <div className="text-xs text-red-500 mt-1">{errors.fallbackText}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="playback" title="Playback behavior" icon={<PlayCircle size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {playbackToggles.map((toggle) => (
                        <button
                            key={toggle.key}
                            type="button"
                            className={`text-left px-3 py-2 rounded border text-xs font-semibold transition-colors duration-150 ${toggle.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue(toggle.key, !toggle.value)}
                            disabled={locked}
                        >
                            <div className="text-sm font-semibold">{toggle.label}</div>
                            <div className="text-[11px] text-[color:var(--fg-muted)]/90">{toggle.description}</div>
                        </button>
                    ))}
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<Palette size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Background color</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="color"
                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                value={backgroundColorSwatch}
                                onChange={(event) => setFieldValue('backgroundColor', event.target.value)}
                                disabled={locked}
                                aria-label="Background color"
                            />
                            <input
                                className="input flex-1 font-mono text-xs"
                                value={backgroundColorValue}
                                onChange={(event) => setFieldValue('backgroundColor', event.target.value)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="var(--surface) or #000000"
                                disabled={locked}
                            />
                        </div>
                        {errors.backgroundColor && <div className="text-xs text-red-500 mt-1">{errors.backgroundColor}</div>}
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Supports CSS variables or hex values.</div>
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Shape</label>
                        <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {VIDEO_SHAPES.map((shape) => (
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
                            <label className="block text-[color:var(--fg-muted)] mb-1">Border width (px)</label>
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
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <input
                                    className="input w-24"
                                    type="number"
                                    min={minBorderWidth}
                                    max={maxBorderWidth}
                                    step={borderWidthStep}
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
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Border radius (px)</label>
                            <input
                                type="range"
                                className="w-full accent-[color:var(--accent)]"
                                min={minBorderRadius}
                                max={maxBorderRadius}
                                step={borderRadiusStep}
                                value={sliderBorderRadius}
                                onChange={(event) => setFieldValue('borderRadius', Number(event.target.value))}
                                disabled={locked}
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <input
                                    className="input w-24"
                                    type="number"
                                    min={minBorderRadius}
                                    max={maxBorderRadius}
                                    step={borderRadiusStep}
                                    value={borderRadiusInputValue}
                                    placeholder={`${minBorderRadius}-${maxBorderRadius}`}
                                    onChange={(event) => setFieldValue('borderRadius', event.target.value === '' ? undefined : Number(event.target.value))}
                                    onKeyDown={onCommitKeyDown}
                                    disabled={locked}
                                />
                                <button
                                    type="button"
                                    className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                    onClick={() => setFieldValue('borderRadius', undefined)}
                                    disabled={locked || !customBorderRadius}
                                >
                                    Auto
                                </button>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">{customBorderRadius ? `${sliderBorderRadius}px` : `Defaults to ${defaultBorderRadius}px`}</div>
                            </div>
                            {errors.borderRadius && <div className="text-xs text-red-500 mt-1">{errors.borderRadius}</div>}
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
                                placeholder="#e5e7eb or var(--border)"
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
                            maxLength={160}
                            placeholder="Short name for screen readers"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Overrides the spoken label; leave empty to reuse the visible text.</div>
                        {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                        <textarea
                            className="input w-full min-h-[4.5rem]"
                            value={ariaDescriptionValue}
                            onChange={(event) => setFieldValue('ariaDescription', event.target.value || undefined)}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Optional extra context for assistive tech.</div>
                        {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[color:var(--fg-muted)] mb-1">Player title</label>
                        <input
                            className="input w-full"
                            value={titleValue}
                            onChange={(event) => setFieldValue('title', event.target.value)}
                            onKeyDown={onCommitKeyDown}
                            maxLength={120}
                            placeholder="Accessible title used for iframe/video elements"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Appears in iframe title attributes and helps screen readers describe the content.</div>
                        {errors.title && <div className="text-xs text-red-500 mt-1">{errors.title}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
