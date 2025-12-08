import React, { useState } from 'react';
import { z } from 'zod';
import { AlignLeft, Bold as BoldIcon, ChevronDown, ChevronRight, Italic as ItalicIcon, Link as LinkIcon, Sparkles } from 'lucide-react';

import { ALLOWED_HTTP_SCHEME_LABEL } from '../../../../shared/widgets/linkUrl';
import LinkPreviewPanel from './LinkPreviewPanel';
import { deriveNumberBounds, isLinkFontValue, isLinkVariantValue, isLinkWeightValue, TEXT_WEIGHTS } from './shared';
import type { LinkFontOption, LinkVariantOption, LinkWeightOption } from './shared';
import { SchemaUrlField } from './SchemaFields';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'destination' | 'typography' | 'icons';

type LinkWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
    rawUrl: string;
    fieldError: string | null;
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

export function LinkWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults, rawUrl, fieldError }: LinkWidgetSettingsProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ destination: true, typography: true, icons: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);
    const urlValue = typeof values.url === 'string'
        ? values.url
        : (typeof getDefault('url') === 'string' ? String(getDefault('url')) : '');
    const labelValue = typeof values.label === 'string'
        ? values.label
        : (typeof getDefault('label') === 'string' ? String(getDefault('label')) : '');
    const variantValue = isLinkVariantValue(values.variant)
        ? values.variant
        : (isLinkVariantValue(getDefault('variant')) ? getDefault('variant') as LinkVariantOption : 'button');
    const fontValue = isLinkFontValue(values.font)
        ? values.font as LinkFontOption
        : (isLinkFontValue(getDefault('font')) ? getDefault('font') as LinkFontOption : 'system');
    const weightValue = isLinkWeightValue(values.weight)
        ? values.weight as LinkWeightOption
        : (isLinkWeightValue(getDefault('weight')) ? getDefault('weight') as LinkWeightOption : 'bold');
    const italicDefault = typeof getDefault('italic') === 'boolean' ? Boolean(getDefault('italic')) : false;
    const italicValue = typeof values.italic === 'boolean' ? values.italic : italicDefault;
    const iconLeftValue = typeof values.iconLeft === 'string' ? values.iconLeft : '';
    const iconRightValue = typeof values.iconRight === 'string' ? values.iconRight : '';
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 8;
    const maxFontSize = fontSizeMeta?.max ?? 128;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = widgetDefaults && typeof widgetDefaults.fontSize === 'number' ? widgetDefaults.fontSize : 16;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const variantOptions: Array<{ value: LinkVariantOption; label: string; description: string }> = [
        { value: 'button', label: 'Button', description: 'Rounded pill-style button with accent fill.' },
        { value: 'text', label: 'Text link', description: 'Inline link that inherits theme accent.' },
        { value: 'card', label: 'Card', description: 'Full-width card with border and metadata.' },
    ];
    const fontOptions: Array<{ value: LinkFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const iconCharLimit = 24;

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="destination" title="Destination & label" icon={<LinkIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">URL *</label>
                    <SchemaUrlField
                        value={urlValue}
                        disabled={locked}
                        onChange={(next) => setFieldValue('url', next ?? '')}
                        onKeyDown={onCommitKeyDown}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)]">Supports {ALLOWED_HTTP_SCHEME_LABEL} links. Missing protocol defaults to https://.</div>
                    {errors.url && <div className="text-xs text-red-500">{errors.url}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Label *</label>
                    <input
                        className="input w-full"
                        value={labelValue}
                        maxLength={80}
                        onChange={(e) => setFieldValue('label', e.target.value)}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                        <span>{labelValue.length}/80 characters</span>
                        <span>Shown to visitors</span>
                    </div>
                    {errors.label && <div className="text-xs text-red-500 mt-1">{errors.label}</div>}
                </div>
                <LinkPreviewPanel rawUrl={rawUrl} fieldError={fieldError} disabled={locked} />
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<AlignLeft size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Variant</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {variantOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${variantValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('variant', option.value)}
                                disabled={locked}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                    {errors.variant && <div className="text-xs text-red-500">{errors.variant}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font</label>
                    <div className="rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 p-3 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-white">
                            {fontOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors duration-150 ${fontValue === option.value ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)] shadow-md' : 'bg-white/5 border-white/30 text-white/80 hover:bg-[color:var(--accent)]/80 hover:text-white'}`}
                                    onClick={() => setFieldValue('font', option.value)}
                                    disabled={locked}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{option.label}</span>
                                        <span className="text-lg font-semibold">{option.sample}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    {errors.font && <div className="text-xs text-red-500 mt-1">{errors.font}</div>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Weight</label>
                        <div className="flex gap-2">
                            {TEXT_WEIGHTS.map((weight) => (
                                <button
                                    key={weight}
                                    type="button"
                                    className={`flex-1 px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${weightValue === weight ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('weight', weight)}
                                    disabled={locked}
                                >
                                    <span className="flex items-center gap-1">
                                        <BoldIcon size={14} />
                                        {weight === 'bold' ? 'Bold' : 'Normal'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {errors.weight && <div className="text-xs text-red-500 mt-1">{errors.weight}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Italic</label>
                        <button
                            type="button"
                            className={`w-full px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${italicValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue('italic', !italicValue)}
                            disabled={locked}
                        >
                            <span className="flex items-center gap-2 justify-center">
                                <ItalicIcon size={14} />
                                {italicValue ? 'Enabled' : 'Disabled'}
                            </span>
                        </button>
                        {errors.italic && <div className="text-xs text-red-500 mt-1">{errors.italic}</div>}
                    </div>
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
                            className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('fontSize', undefined)}
                            disabled={locked || !customFontSize}
                        >
                            Auto
                        </button>
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : `Defaults to ${defaultFontSize}px`}</div>
                    </div>
                    {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="icons" title="Accessibility" icon={<Sparkles size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                            <input
                                className="input w-full"
                                value={ariaLabelValue}
                                onChange={(e) => setFieldValue('ariaLabel', e.target.value || undefined)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="Short name for screen readers"
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Overrides the spoken label; leave empty to reuse the visible text.</div>
                            {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                            <textarea
                                className="input w-full min-h-[4rem]"
                                value={ariaDescriptionValue}
                                onChange={(e) => setFieldValue('ariaDescription', e.target.value || undefined)}
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Optional extra context for assistive tech.</div>
                            {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Icon left</label>
                            <input
                                className="input w-full"
                                value={iconLeftValue}
                                maxLength={iconCharLimit}
                                onChange={(e) => setFieldValue('iconLeft', e.target.value || undefined)}
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                                <span>{iconLeftValue.length}/{iconCharLimit}</span>
                                <span>Emoji or short text</span>
                            </div>
                            {errors.iconLeft && <div className="text-xs text-red-500 mt-1">{errors.iconLeft}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Icon right</label>
                            <input
                                className="input w-full"
                                value={iconRightValue}
                                maxLength={iconCharLimit}
                                onChange={(e) => setFieldValue('iconRight', e.target.value || undefined)}
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                                <span>{iconRightValue.length}/{iconCharLimit}</span>
                                <span>Optional suffix</span>
                            </div>
                            {errors.iconRight && <div className="text-xs text-red-500 mt-1">{errors.iconRight}</div>}
                        </div>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
