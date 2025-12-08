import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Github, LayoutGrid, List, Palette, Sparkles } from 'lucide-react';
import { z } from 'zod';

import { deriveNumberBounds, HEX_COLOR_RE } from './shared';
import type { WidgetSettingsComponentProps } from './types';

type SectionKey = 'profile' | 'appearance' | 'accessibility';

const LAYOUT_OPTIONS: Array<{ value: 'cards' | 'list'; label: string; description: string; icon: React.ReactNode }> = [
    { value: 'cards', label: 'Card grid', description: 'Responsive grid with larger repo summaries.', icon: <LayoutGrid size={14} /> },
    { value: 'list', label: 'Compact list', description: 'Single column with concise repo rows.', icon: <List size={14} /> },
];

const ANNOUNCE_MODE_OPTIONS: Array<{ value: 'off' | 'polite' | 'assertive'; label: string; description: string }> = [
    { value: 'off', label: 'Off', description: 'Do not announce updates to assistive tech.' },
    { value: 'polite', label: 'Polite', description: 'Announce after other speech finishes.' },
    { value: 'assertive', label: 'Assertive', description: 'Interrupt to announce status updates.' },
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

export function GitHubReposWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: WidgetSettingsComponentProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ profile: true, appearance: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);

    const usernameValue = typeof values.username === 'string'
        ? values.username
        : (typeof getDefault('username') === 'string' ? String(getDefault('username')) : '');
    const layoutValue = values.layout === 'list' ? 'list' : (getDefault('layout') === 'list' ? 'list' : 'cards');

    const maxItemsField = schemaFields.get('maxItems');
    const maxItemsMeta = maxItemsField instanceof z.ZodNumber ? deriveNumberBounds(maxItemsField as z.ZodNumber) : undefined;
    const minItems = maxItemsMeta?.min ?? 1;
    const maxItems = maxItemsMeta?.max ?? 30;
    const step = maxItemsMeta?.step ?? 1;
    const defaultMaxItems = typeof getDefault('maxItems') === 'number' ? Number(getDefault('maxItems')) : 6;
    const customMaxItems = typeof values.maxItems === 'number' && Number.isFinite(values.maxItems);
    const sliderValue = customMaxItems ? Number(values.maxItems) : defaultMaxItems;
    const maxItemsInputValue = customMaxItems ? Number(values.maxItems) : '';

    const ariaLabelValue = typeof values.ariaLabel === 'string'
        ? values.ariaLabel
        : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string'
        ? values.ariaDescription
        : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const refreshLabelValue = typeof values.refreshLabel === 'string'
        ? values.refreshLabel
        : (typeof getDefault('refreshLabel') === 'string' ? String(getDefault('refreshLabel')) : '');
    const announceModeValue = values.announceMode === 'assertive' || values.announceMode === 'off'
        ? values.announceMode
        : (getDefault('announceMode') === 'assertive' || getDefault('announceMode') === 'off' ? getDefault('announceMode') as 'off' | 'assertive' : 'polite');

    const colorValues = useMemo(() => ({
        containerBackgroundColor: typeof values.containerBackgroundColor === 'string' ? values.containerBackgroundColor : (typeof getDefault('containerBackgroundColor') === 'string' ? String(getDefault('containerBackgroundColor')) : ''),
        cardBackgroundColor: typeof values.cardBackgroundColor === 'string' ? values.cardBackgroundColor : (typeof getDefault('cardBackgroundColor') === 'string' ? String(getDefault('cardBackgroundColor')) : ''),
        cardBorderColor: typeof values.cardBorderColor === 'string' ? values.cardBorderColor : (typeof getDefault('cardBorderColor') === 'string' ? String(getDefault('cardBorderColor')) : ''),
        cardTextColor: typeof values.cardTextColor === 'string' ? values.cardTextColor : (typeof getDefault('cardTextColor') === 'string' ? String(getDefault('cardTextColor')) : ''),
        cardMutedColor: typeof values.cardMutedColor === 'string' ? values.cardMutedColor : (typeof getDefault('cardMutedColor') === 'string' ? String(getDefault('cardMutedColor')) : ''),
    }), [values, widgetDefaults]);

    const colorFields: Array<{ key: keyof typeof colorValues; label: string; helper: string; swatchFallback: string }> = [
        { key: 'containerBackgroundColor', label: 'Container background', helper: 'Overrides the section background. Accepts CSS variables.', swatchFallback: '#0f172a' },
        { key: 'cardBackgroundColor', label: 'Card background', helper: 'Applies to each repo card/list row.', swatchFallback: '#111827' },
        { key: 'cardBorderColor', label: 'Card border color', helper: 'Leave blank to keep the default border token.', swatchFallback: '#1f2937' },
        { key: 'cardTextColor', label: 'Primary text color', helper: 'Used for repository titles and badges.', swatchFallback: '#f4f4f5' },
        { key: 'cardMutedColor', label: 'Muted text color', helper: 'Used for metadata like stars or timestamps.', swatchFallback: '#94a3b8' },
    ];

    const setOptionalString = (key: string, next: string) => {
        const trimmed = next.trim();
        setFieldValue(key, trimmed.length ? next : undefined);
    };

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="profile" title="Profile & layout" icon={<Github size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">GitHub username *</label>
                        <input
                            className="input w-full"
                            value={usernameValue}
                            onChange={(e) => setFieldValue('username', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            maxLength={39}
                            placeholder="e.g. snxethan"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1 flex items-center justify-between">
                            <span>{usernameValue.length}/39 characters</span>
                            <span>Use the account that owns the repos you want to feature.</span>
                        </div>
                        {errors.username && <div className="text-xs text-red-500 mt-1">{errors.username}</div>}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Max repositories</label>
                            <input
                                type="range"
                                className="w-full accent-[color:var(--accent)]"
                                min={minItems}
                                max={maxItems}
                                step={step}
                                value={sliderValue}
                                onChange={(e) => setFieldValue('maxItems', Number(e.target.value))}
                                disabled={locked}
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <input
                                    className="input w-24"
                                    type="number"
                                    min={minItems}
                                    max={maxItems}
                                    step={step}
                                    value={maxItemsInputValue}
                                    placeholder={`${minItems}-${maxItems}`}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setFieldValue('maxItems', raw === '' ? undefined : Number(raw));
                                    }}
                                    onKeyDown={onCommitKeyDown}
                                    disabled={locked}
                                />
                                <button
                                    type="button"
                                    className="px-3 py-1.5 rounded border border-[color:var(--border)] text-xs font-semibold"
                                    onClick={() => setFieldValue('maxItems', undefined)}
                                    disabled={locked || !customMaxItems}
                                >
                                    Auto
                                </button>
                                <div className="text-[11px] text-[color:var(--fg-muted)]">{customMaxItems ? `${sliderValue} repos` : `Defaults to ${defaultMaxItems}`}</div>
                            </div>
                            {errors.maxItems && <div className="text-xs text-red-500 mt-1">{errors.maxItems}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Layout</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {LAYOUT_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`text-left px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${layoutValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                        onClick={() => setFieldValue('layout', option.value)}
                                        disabled={locked}
                                        aria-pressed={layoutValue === option.value}
                                    >
                                        <div className="flex items-center gap-2">
                                            {option.icon}
                                            <div>
                                                <div className="text-sm font-semibold">{option.label}</div>
                                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {errors.layout && <div className="text-xs text-red-500 mt-1">{errors.layout}</div>}
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="appearance" title="Appearance" icon={<Palette size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    {colorFields.map(({ key, label, helper, swatchFallback }) => {
                        const value = colorValues[key] || '';
                        const swatch = HEX_COLOR_RE.test(value) ? value : swatchFallback;
                        return (
                            <div key={key}>
                                <label className="block text-[color:var(--fg-muted)] mb-1">{label}</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="color"
                                        className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-9 w-12 cursor-pointer"
                                        value={swatch}
                                        onChange={(e) => setFieldValue(key, e.target.value)}
                                        disabled={locked}
                                        aria-label={`${label} color`}
                                    />
                                    <input
                                        className="input flex-1 font-mono text-xs"
                                        value={value}
                                        onChange={(e) => setFieldValue(key, e.target.value)}
                                        onKeyDown={onCommitKeyDown}
                                        placeholder="var(--surface)"
                                        disabled={locked}
                                    />
                                    <button
                                        type="button"
                                        className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold"
                                        onClick={() => setFieldValue(key, undefined)}
                                        disabled={locked || !value}
                                    >
                                        Reset
                                    </button>
                                </div>
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">{helper}</div>
                                {errors[key as string] && <div className="text-xs text-red-500 mt-1">{errors[key as string]}</div>}
                            </div>
                        );
                    })}
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Announcements & labels" icon={<Sparkles size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Region aria-label</label>
                            <input
                                className="input w-full"
                                value={ariaLabelValue}
                                onChange={(e) => setOptionalString('ariaLabel', e.target.value)}
                                onKeyDown={onCommitKeyDown}
                                placeholder="GitHub repositories"
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Overrides the spoken label for the repo section.</div>
                            {errors.ariaLabel && <div className="text-xs text-red-500 mt-1">{errors.ariaLabel}</div>}
                        </div>
                        <div>
                            <label className="block text-[color:var(--fg-muted)] mb-1">Aria description</label>
                            <textarea
                                className="input w-full min-h-[4rem]"
                                value={ariaDescriptionValue}
                                onChange={(e) => setOptionalString('ariaDescription', e.target.value)}
                                disabled={locked}
                            />
                            <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Optional extra context read after the label.</div>
                            {errors.ariaDescription && <div className="text-xs text-red-500 mt-1">{errors.ariaDescription}</div>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Status announcements</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {ANNOUNCE_MODE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`text-left px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${announceModeValue === option.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('announceMode', option.value)}
                                    disabled={locked}
                                    aria-pressed={announceModeValue === option.value}
                                >
                                    <div className="text-sm font-semibold">{option.label}</div>
                                    <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                                </button>
                            ))}
                        </div>
                        {errors.announceMode && <div className="text-xs text-red-500 mt-1">{errors.announceMode}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Refresh button label</label>
                        <input
                            className="input w-full"
                            value={refreshLabelValue}
                            onChange={(e) => setOptionalString('refreshLabel', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            placeholder="Refresh repositories"
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Shown on the top-right action button.</div>
                        {errors.refreshLabel && <div className="text-xs text-red-500 mt-1">{errors.refreshLabel}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
