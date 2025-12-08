import React, { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold as BoldIcon, ChevronDown, ChevronRight, Italic as ItalicIcon, Type, Unlock } from 'lucide-react';
import { z } from 'zod';

import { deriveNumberBounds, HEX_COLOR_RE, isTextAlignValue, isTextFontValue, isTextFormatValue, isTextVariantValue, isTextWeightValue, TEXT_FORMATS, TEXT_WEIGHTS } from './shared';
import type { TextAlignOption, TextFontOption, TextFormatOption, TextVariantOption, TextWeightOption } from './shared';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'content' | 'typography' | 'accessibility';

type TextWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
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

export function TextWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: TextWidgetSettingsProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ content: true, typography: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => {
        if (!widgetDefaults) return undefined;
        return widgetDefaults[key];
    };
    const textValue = typeof values.text === 'string'
        ? values.text
        : (typeof getDefault('text') === 'string' ? String(getDefault('text')) : '');
    const formatValue = isTextFormatValue(values.format)
        ? values.format
        : (isTextFormatValue(getDefault('format')) ? getDefault('format') as TextFormatOption : 'plain');
    const variantValue = isTextVariantValue(values.variant)
        ? values.variant
        : (isTextVariantValue(getDefault('variant')) ? getDefault('variant') as TextVariantOption : 'paragraph');
    const alignValue = isTextAlignValue(values.align)
        ? values.align
        : (isTextAlignValue(getDefault('align')) ? getDefault('align') as TextAlignOption : 'left');
    const fontValue = isTextFontValue(values.font)
        ? values.font
        : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');
    const weightValue = isTextWeightValue(values.weight)
        ? values.weight
        : (isTextWeightValue(getDefault('weight')) ? getDefault('weight') as TextWeightOption : 'normal');
    const italicDefault = typeof getDefault('italic') === 'boolean' ? Boolean(getDefault('italic')) : false;
    const italicValue = typeof values.italic === 'boolean' ? values.italic : italicDefault;
    const colorValue = typeof values.color === 'string' ? values.color : (typeof getDefault('color') === 'string' ? String(getDefault('color')) : '');
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
    const defaultFontSize = getDefault('fontSize');
    const fallbackFontSize = typeof defaultFontSize === 'number' && Number.isFinite(defaultFontSize)
        ? Number(defaultFontSize)
        : Math.min(Math.max(16, minFontSize), maxFontSize);
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : fallbackFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const colorSwatch = HEX_COLOR_RE.test(colorValue) ? colorValue : '#1f2937';
    const variantOptions: Array<{ value: TextVariantOption; label: string; description: string }> = [
        { value: 'paragraph', label: 'Paragraph', description: 'Standard body copy with inline formatting.' },
        { value: 'h2', label: 'Heading 2', description: 'Large section heading.' },
        { value: 'h3', label: 'Heading 3', description: 'Smaller heading for sub-sections.' },
    ];
    const alignmentOptions: Array<{ value: TextAlignOption; label: string; icon: React.ReactNode }> = [
        { value: 'left', label: 'Left align', icon: <AlignLeft size={14} /> },
        { value: 'center', label: 'Center align', icon: <AlignCenter size={14} /> },
        { value: 'right', label: 'Right align', icon: <AlignRight size={14} /> },
    ];
    const fontOptions: Array<{ value: TextFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const formatHelper = formatValue === 'markdown'
        ? 'Use **bold**, _italic_, lists, links, and more with GitHub-flavored Markdown.'
        : 'Best for simple paragraphs. Switch to Markdown for rich formatting.';

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="content" title="Text content" icon={<Type size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Text *</label>
                    <textarea
                        className="input w-full min-h-[6rem]"
                        value={textValue}
                        onChange={(e) => setFieldValue('text', e.target.value)}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1 flex items-center justify-between">
                        <span>{textValue.length} characters</span>
                        <span>{formatValue === 'markdown' ? 'Markdown enabled' : 'Plain text'}</span>
                    </div>
                    {errors.text && <div className="text-xs text-red-500 mt-1">{errors.text}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Format</label>
                    <div className="flex flex-wrap gap-2">
                        {TEXT_FORMATS.map((fmt) => (
                            <button
                                key={fmt}
                                type="button"
                                className={`flex-1 min-w-[8rem] px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${formatValue === fmt ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)]' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]/70 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('format', fmt)}
                                disabled={locked}
                            >
                                {fmt === 'plain' ? 'Plain text' : 'Markdown'}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">{formatHelper}</div>
                </div>
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
                    <label className="block text-[color:var(--fg-muted)] mb-1">Alignment</label>
                    <div className="flex flex-wrap gap-2">
                        {alignmentOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`flex-1 min-w-[5rem] px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${alignValue === option.value ? 'bg-[color:var(--accent)]/25 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] bg-[color:var(--surface)]/70 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('align', option.value)}
                                disabled={locked}
                                title={option.label}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-[11px]">{option.label.split(' ')[0]}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {errors.align && <div className="text-xs text-red-500 mt-1">{errors.align}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Font family</label>
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
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{customFontSize ? `${fontSizeInputValue}px` : 'Inherit theme size'}</div>
                    </div>
                    {errors.fontSize && <div className="text-xs text-red-500 mt-1">{errors.fontSize}</div>}
                </div>

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Text color</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={colorSwatch}
                            onChange={(e) => setFieldValue('color', e.target.value)}
                            disabled={locked}
                            aria-label="Pick text color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={colorValue}
                            placeholder="Inherit"
                            onChange={(e) => setFieldValue('color', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('color', undefined)}
                            disabled={locked || !colorValue}
                        >
                            Reset
                        </button>
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to inherit the theme color or use CSS variables like var(--fg).</div>
                    {errors.color && <div className="text-xs text-red-500 mt-1">{errors.color}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Unlock size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Aria label</label>
                        <input
                            className="input w-full"
                            value={ariaLabelValue}
                            onChange={(e) => setFieldValue('ariaLabel', e.target.value || undefined)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Optional short label"
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
            </SectionCard>
        </div>
    );
}
