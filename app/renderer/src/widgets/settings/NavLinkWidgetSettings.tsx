import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronRight, Link as LinkIcon, Sparkles } from 'lucide-react';

import { deriveNumberBounds, HEX_COLOR_RE, isNavLinkStyleValue, isTextAlignValue, isTextFontValue } from './shared';
import type { NavLinkStyleOption, TextAlignOption, TextFontOption } from './shared';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'destination' | 'typography' | 'accessibility';

type NavLinkPageOption = { id: string; title: string };

type NavLinkWidgetSettingsProps = WidgetSettingsComponentProps & {
    schemaFields: Map<string, z.ZodTypeAny>;
    pages: NavLinkPageOption[];
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

export function NavLinkWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults, pages }: NavLinkWidgetSettingsProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ destination: true, typography: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);
    const labelValue = typeof values.label === 'string'
        ? values.label
        : (typeof getDefault('label') === 'string' ? String(getDefault('label')) : '');
    const targetPageValue = typeof values.targetPageId === 'string'
        ? values.targetPageId
        : (typeof getDefault('targetPageId') === 'string' ? String(getDefault('targetPageId')) : '');
    const styleValue = isNavLinkStyleValue(values.style)
        ? values.style as NavLinkStyleOption
        : (isNavLinkStyleValue(getDefault('style')) ? getDefault('style') as NavLinkStyleOption : 'link');
    const alignValue = isTextAlignValue(values.align)
        ? values.align as TextAlignOption
        : (isTextAlignValue(getDefault('align')) ? getDefault('align') as TextAlignOption : 'left');
    const fontValue = isTextFontValue(values.font)
        ? values.font as TextFontOption
        : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');
    const underlineDefault = typeof getDefault('underline') === 'boolean' ? Boolean(getDefault('underline')) : false;
    const underlineValue = typeof values.underline === 'boolean' ? values.underline : underlineDefault;
    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const colorDefault = typeof getDefault('color') === 'string' ? String(getDefault('color')) : '';
    const colorValue = typeof values.color === 'string' ? values.color : colorDefault;
    const textColorDefault = typeof getDefault('textColor') === 'string' ? String(getDefault('textColor')) : '';
    const textColorValue = typeof values.textColor === 'string' ? values.textColor : textColorDefault;
    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 10;
    const maxFontSize = fontSizeMeta?.max ?? 64;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = typeof getDefault('fontSize') === 'number' ? Number(getDefault('fontSize')) : 14;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';
    const labelCharLimit = 60;
    const fontOptions: Array<{ value: TextFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];
    const alignmentOptions: Array<{ value: TextAlignOption; label: string; icon: React.ReactNode }> = [
        { value: 'left', label: 'Left', icon: <AlignLeft size={14} /> },
        { value: 'center', label: 'Center', icon: <AlignCenter size={14} /> },
        { value: 'right', label: 'Right', icon: <AlignRight size={14} /> },
    ];
    const styleOptions: Array<{ value: NavLinkStyleOption; label: string; description: string }> = [
        { value: 'link', label: 'Text link', description: 'Inline link that matches your theme.' },
        { value: 'button', label: 'Button', description: 'Solid button with accent background.' },
    ];
    const toColorInput = (value: string, fallback: string) => (HEX_COLOR_RE.test(value) ? value : fallback);
    const linkColorSwatch = toColorInput(colorValue, '#2563eb');
    const buttonTextColorSwatch = toColorInput(textColorValue || colorValue, '#ffffff');
    const hasPages = pages.length > 0;
    const sortedPages = useMemo(() => pages.slice().sort((a, b) => a.title.localeCompare(b.title)), [pages]);

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="destination" title="Destination & label" icon={<LinkIcon size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Target page *</label>
                    {hasPages ? (
                        <select
                            className="input w-full"
                            value={targetPageValue}
                            onChange={(e) => setFieldValue('targetPageId', e.target.value)}
                            disabled={locked}
                        >
                            <option value="">Select page…</option>
                            {sortedPages.map((page) => (
                                <option key={page.id} value={page.id}>{page.title}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="px-3 py-2 rounded-lg border border-dashed border-[color:var(--border)] text-xs text-[color:var(--fg-muted)] bg-[color:var(--muted)]/30">
                            No pages available. Create a page in the canvas sidebar first.
                        </div>
                    )}
                    {errors.targetPageId && <div className="text-xs text-red-500 mt-1">{errors.targetPageId}</div>}
                </div>
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Label *</label>
                    <input
                        className="input w-full"
                        value={labelValue}
                        maxLength={labelCharLimit}
                        onChange={(e) => setFieldValue('label', e.target.value)}
                        onKeyDown={onCommitKeyDown}
                        disabled={locked}
                    />
                    <div className="text-[10px] text-[color:var(--fg-muted)] flex justify-between mt-1">
                        <span>{labelValue.length}/{labelCharLimit}</span>
                        <span>Shown on the button/link</span>
                    </div>
                    {errors.label && <div className="text-xs text-red-500 mt-1">{errors.label}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<AlignLeft size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Style</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {styleOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border transition-colors duration-150 ${styleValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('style', option.value)}
                                disabled={locked}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                    {errors.style && <div className="text-xs text-red-500">{errors.style}</div>}
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
                                title={`${option.label} align`}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-[11px]">{option.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {errors.align && <div className="text-xs text-red-500 mt-1">{errors.align}</div>}
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

                {styleValue === 'link' && (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Underline</label>
                        <button
                            type="button"
                            className={`w-full px-3 py-1.5 rounded border text-xs font-semibold transition-colors duration-150 ${underlineValue ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue('underline', !underlineValue)}
                            disabled={locked}
                        >
                            {underlineValue ? 'Underline enabled' : 'Underline disabled'}
                        </button>
                        {errors.underline && <div className="text-xs text-red-500 mt-1">{errors.underline}</div>}
                    </div>
                )}

                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">{styleValue === 'button' ? 'Background color' : 'Link color'}</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={linkColorSwatch}
                            onChange={(e) => setFieldValue('color', e.target.value)}
                            disabled={locked}
                            aria-label="Primary color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={colorValue}
                            placeholder={styleValue === 'button' ? '#2563eb' : 'currentColor'}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setFieldValue('color', raw || undefined);
                            }}
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
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to inherit the theme accent or use CSS variables like var(--accent).</div>
                    {errors.color && <div className="text-xs text-red-500 mt-1">{errors.color}</div>}
                </div>

                {styleValue === 'button' && (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Text color</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="color"
                                className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                                value={buttonTextColorSwatch}
                                onChange={(e) => setFieldValue('textColor', e.target.value)}
                                disabled={locked}
                                aria-label="Button text color"
                            />
                            <input
                                className="input flex-1 font-mono text-xs"
                                value={textColorValue}
                                placeholder="#ffffff"
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setFieldValue('textColor', raw || undefined);
                                }}
                                onKeyDown={onCommitKeyDown}
                                disabled={locked}
                            />
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                                onClick={() => setFieldValue('textColor', undefined)}
                                disabled={locked || !textColorValue}
                            >
                                Reset
                            </button>
                        </div>
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to auto-select a contrasting text color.</div>
                        {errors.textColor && <div className="text-xs text-red-500 mt-1">{errors.textColor}</div>}
                    </div>
                )}
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Sparkles size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
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
            </SectionCard>
        </div>
    );
}
