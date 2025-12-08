import React, { useMemo, useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight, Image as ImageIcon, Link as LinkIcon, Palette, Type as TypeIcon, Unlock } from 'lucide-react';
import { z } from 'zod';

import { useAssets } from '../../providers/AssetsProvider';

import { SchemaAssetField, SchemaUrlField } from './SchemaFields';
import { deriveNumberBounds, HEX_COLOR_RE, isTextFontValue, type TextFontOption } from './shared';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'overview' | 'slides' | 'typography' | 'accessibility';

type ProjectWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
};

type HeadingLevelOption = 'h2' | 'h3';

const HEADING_OPTIONS: Array<{ value: HeadingLevelOption; label: string; description: string }> = [
    { value: 'h2', label: 'Heading 2', description: 'Large section title with stronger emphasis.' },
    { value: 'h3', label: 'Heading 3', description: 'Compact sub-heading ideal for cards.' },
];

const FONT_OPTIONS: Array<{ value: TextFontOption; label: string; sample: string; helper: string }> = [
    { value: 'system', label: 'System Sans', sample: 'Aa', helper: 'Modern sans-serif body copy.' },
    { value: 'serif', label: 'Serif', sample: 'Aa', helper: 'Editorial, high-contrast look.' },
    { value: 'mono', label: 'Mono', sample: '{ }', helper: 'Technical feel for code style.' },
];

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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]"
                onClick={() => toggleSection(sectionKey)}
                aria-expanded={open}
            >
                <span className="flex items-center gap-2">
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

function isHeadingLevelValue(value: unknown): value is HeadingLevelOption {
    return value === 'h2' || value === 'h3';
}

export function ProjectWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: ProjectWidgetSettingsProps) {
    const assets = useAssets();
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ overview: true, slides: true, typography: true, accessibility: true });

    const toggleSection = (key: SectionKey) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);

    const titleValue = typeof values.title === 'string'
        ? values.title
        : (typeof getDefault('title') === 'string' ? String(getDefault('title')) : '');
    const descriptionValue = typeof values.description === 'string'
        ? values.description
        : (typeof getDefault('description') === 'string' ? String(getDefault('description')) : '');
    const linkValue = typeof values.link === 'string'
        ? values.link
        : (typeof getDefault('link') === 'string' ? String(getDefault('link')) : '');
    const linkLabelValue = typeof values.linkLabel === 'string'
        ? values.linkLabel
        : (typeof getDefault('linkLabel') === 'string' ? String(getDefault('linkLabel')) : '');
    const imageValue = typeof values.image === 'string'
        ? values.image
        : (typeof getDefault('image') === 'string' ? String(getDefault('image')) : '');
    const imageAltValue = typeof values.imageAlt === 'string'
        ? values.imageAlt
        : (typeof getDefault('imageAlt') === 'string' ? String(getDefault('imageAlt')) : '');
    const backgroundColorValue = typeof values.backgroundColor === 'string'
        ? values.backgroundColor
        : (typeof getDefault('backgroundColor') === 'string' ? String(getDefault('backgroundColor')) : '');
    const headingLevelValue = isHeadingLevelValue(values.headingLevel)
        ? values.headingLevel
        : (isHeadingLevelValue(getDefault('headingLevel')) ? getDefault('headingLevel') as HeadingLevelOption : 'h3');
    const fontValue = isTextFontValue(values.font)
        ? values.font
        : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');

    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 12;
    const maxFontSize = fontSizeMeta?.max ?? 64;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = typeof getDefault('fontSize') === 'number' ? Number(getDefault('fontSize')) : 16;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';

    const backgroundColorSwatch = HEX_COLOR_RE.test(backgroundColorValue || '') ? backgroundColorValue : '#f1f5f9';
    const cardPreview = useMemo(() => {
        const trimmedBackground = backgroundColorValue?.trim();
        const safeBackground = trimmedBackground && trimmedBackground.length ? trimmedBackground : 'var(--surface)';
        const hasImage = Boolean(imageValue?.trim());
        const isAsset = hasImage && imageValue.startsWith('asset://');
        const displayTitle = titleValue?.trim().length ? titleValue : 'Project title';
        const displayDescription = descriptionValue?.trim().length ? descriptionValue : 'Add a short blurb to describe what makes this project special.';
        const displayLinkLabel = linkLabelValue?.trim().length ? linkLabelValue : 'View project';
        return {
            background: safeBackground,
            image: hasImage ? imageValue : '',
            isAsset,
            title: displayTitle,
            description: displayDescription,
            linkLabel: displayLinkLabel,
            hasLink: Boolean(linkValue?.trim().length),
        };
    }, [backgroundColorValue, imageValue, titleValue, descriptionValue, linkLabelValue, linkValue]);

    const setOptionalString = (key: string, next: string) => {
        const trimmed = next.trim();
        setFieldValue(key, trimmed.length ? next : undefined);
    };

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="overview" title="Project details" icon={<Briefcase size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Title *</label>
                        <input
                            className="input w-full"
                            value={titleValue}
                            onChange={(e) => setFieldValue('title', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            maxLength={120}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">{titleValue.length}/120 characters</div>
                        {errors.title && <div className="text-xs text-red-500 mt-1">{errors.title}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Description</label>
                        <textarea
                            className="input w-full min-h-[5rem]"
                            value={descriptionValue}
                            onChange={(e) => setFieldValue('description', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Summarize the impact, stack, or role you played."
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">{descriptionValue.length} characters</div>
                        {errors.description && <div className="text-xs text-red-500 mt-1">{errors.description}</div>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Project link</label>
                            <SchemaUrlField
                                value={linkValue}
                                disabled={locked}
                                onChange={(next) => setFieldValue('link', next && next.length ? next : undefined)}
                                onKeyDown={onCommitKeyDown}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Opens the entire card as an external link.</div>
                            {errors.link && <div className="text-xs text-red-500 mt-1">{errors.link}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Link label</label>
                            <input
                                className="input w-full"
                                value={linkLabelValue}
                                onChange={(e) => setOptionalString('linkLabel', e.target.value)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="e.g. View project"
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Used for accessible link text when the card is clickable.</div>
                            {errors.linkLabel && <div className="text-xs text-red-500 mt-1">{errors.linkLabel}</div>}
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="slides" title="Slides & visuals" icon={<ImageIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_1fr]">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Cover media</label>
                            <SchemaAssetField
                                value={imageValue}
                                placeholder="asset://hash or https://example.com/cover.jpg"
                                disabled={locked}
                                assets={assets}
                                assetKind="image"
                                onChange={(next) => setFieldValue('image', next && next.length ? next : undefined)}
                                onKeyDown={onCommitKeyDown}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Upload or paste a hero image to represent the project.</div>
                            {errors.image && <div className="text-xs text-red-500 mt-1">{errors.image}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Card background color</label>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="color"
                                    className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-9 w-12 cursor-pointer"
                                    value={backgroundColorSwatch}
                                    onChange={(e) => setFieldValue('backgroundColor', e.target.value)}
                                    disabled={locked}
                                    aria-label="Pick project background color"
                                />
                                <input
                                    className="input flex-1 font-mono text-xs"
                                    value={backgroundColorValue}
                                    onChange={(e) => setOptionalString('backgroundColor', e.target.value)}
                                    onKeyDown={onCommitKeyDown}
                                    placeholder="Leave blank for theme surface"
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
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-3">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)] mb-2">
                            <span>Preview</span>
                            <Palette size={12} />
                        </div>
                        <div className="rounded-xl border border-[color:var(--border)] bg-white/90 p-3 space-y-3 shadow-sm" style={{ background: cardPreview.background }}>
                            <div className={`rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/30 h-28 flex items-center justify-center overflow-hidden ${cardPreview.image ? 'p-0' : 'border-dashed text-[color:var(--fg-muted)] text-[11px]'}`}>
                                {cardPreview.image ? (
                                    cardPreview.isAsset ? (
                                        <div className="text-[11px] text-[color:var(--fg-muted)] px-2 truncate w-full">{cardPreview.image}</div>
                                    ) : (
                                        <img src={cardPreview.image} alt="Project cover" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                                    )
                                ) : (
                                    <span>Add a cover image</span>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-[color:var(--fg)]">{cardPreview.title}</div>
                                <div className="text-[12px] text-[color:var(--fg-muted)] leading-snug">{cardPreview.description}</div>
                            </div>
                            <div>
                                {cardPreview.hasLink ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--accent)]">
                                        <LinkIcon size={12} />
                                        {cardPreview.linkLabel}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-[color:var(--fg-muted)]">Add a link to show the CTA hint here.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<TypeIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Heading level</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {HEADING_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${headingLevelValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('headingLevel', option.value)}
                                    disabled={locked}
                                >
                                    <div className="text-sm font-semibold">{option.label}</div>
                                    <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                                </button>
                            ))}
                        </div>
                        {errors.headingLevel && <div className="text-xs text-red-500 mt-1">{errors.headingLevel}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Font family</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {FONT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left transition-colors duration-150 ${fontValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-md' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('font', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">{option.label}</div>
                                            <div className="text-[11px] text-[color:var(--fg-muted)]/80">{option.helper}</div>
                                        </div>
                                        <span className="text-lg font-semibold">{option.sample}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {errors.font && <div className="text-xs text-red-500 mt-1">{errors.font}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Font size</label>
                        <input
                            type="range"
                            className="w-full accent-[color:var(--accent)]"
                            min={minFontSize}
                            max={maxFontSize}
                            step={fontSizeStep}
                            value={sliderFontSize}
                            onChange={(e) => setFieldValue('fontSize', Number(e.target.value))}
                            disabled={locked}
                        />
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <input
                                className="input w-24"
                                type="number"
                                min={minFontSize}
                                max={maxFontSize}
                                step={fontSizeStep}
                                value={fontSizeInputValue}
                                placeholder={`${minFontSize}-${maxFontSize}`}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setFieldValue('fontSize', raw === '' ? undefined : Number(raw));
                                }}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold"
                                onClick={() => setFieldValue('fontSize', undefined)}
                                disabled={locked || !customFontSize}
                            >
                                Auto
                            </button>
                            <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : 'Inherit theme size'}</div>
                        </div>
                        {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Unlock size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                            <input
                                className="input w-full"
                                value={ariaLabelValue}
                                onChange={(e) => setOptionalString('ariaLabel', e.target.value)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="Optional override for the card label"
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave empty to reuse the visible title.</div>
                            {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                            <textarea
                                className="input w-full min-h-[4rem]"
                                value={ariaDescriptionValue}
                                onChange={(e) => setOptionalString('ariaDescription', e.target.value)}
                                placeholder="Optional extra context announced to assistive tech."
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Optional extra context announced to assistive tech.</div>
                            {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Image alt text</label>
                        <input
                            className="input w-full"
                            value={imageAltValue}
                            onChange={(e) => setOptionalString('imageAlt', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Describe the screenshot for non-visual users"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to reuse the project title.</div>
                        {errors.imageAlt && <div className="text-xs text-red-500 mt-1">{errors.imageAlt}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
