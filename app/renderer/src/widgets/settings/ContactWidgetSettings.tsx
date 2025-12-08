import React, { useMemo, useState } from 'react';
import { AlignLeft, Mail, Shield, SlidersHorizontal, Sparkles, ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { z } from 'zod';

import { deriveNumberBounds, HEX_COLOR_RE, isTextFontValue, type TextFontOption } from './shared';
import type { WidgetSettingsComponentProps } from './types';

const LIVE_MODE_OPTIONS: Array<{ value: 'off' | 'polite' | 'assertive'; label: string; description: string }> = [
    { value: 'off', label: 'Off', description: 'No live region updates announced.' },
    { value: 'polite', label: 'Polite', description: 'Announce status updates without interrupting.' },
    { value: 'assertive', label: 'Assertive', description: 'Interrupt to announce status updates.' },
];

const SUBMIT_ACTION_OPTIONS: Array<{ value: 'mailto' | 'event'; label: string; description: string }> = [
    { value: 'mailto', label: 'Mailto link', description: "Open the visitor's email client with a prefilled message." },
    { value: 'event', label: 'Custom event', description: 'Dispatch a browser event that your site can intercept.' },
];

type SectionKey = 'content' | 'validation' | 'submission' | 'typography' | 'accessibility';

type ContactWidgetSettingsProps = WidgetSettingsComponentProps & {
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

export function ContactWidgetSettings({ values, errors, locked, setFieldValue, schemaFields, onCommitKeyDown, widgetDefaults }: ContactWidgetSettingsProps) {
    const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({ content: true, validation: true, submission: true, typography: true, accessibility: true });
    const toggleSection = (key: SectionKey) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const getDefault = (key: string): unknown => (widgetDefaults ? widgetDefaults[key] : undefined);

    const headingValue = typeof values.heading === 'string' ? values.heading : (typeof getDefault('heading') === 'string' ? String(getDefault('heading')) : '');
    const descriptionValue = typeof values.description === 'string' ? values.description : (typeof getDefault('description') === 'string' ? String(getDefault('description')) : '');
    const ariaLabelValue = typeof values.ariaLabel === 'string' ? values.ariaLabel : (typeof getDefault('ariaLabel') === 'string' ? String(getDefault('ariaLabel')) : '');
    const ariaDescriptionValue = typeof values.ariaDescription === 'string' ? values.ariaDescription : (typeof getDefault('ariaDescription') === 'string' ? String(getDefault('ariaDescription')) : '');
    const nameLabelValue = typeof values.nameLabel === 'string' ? values.nameLabel : (typeof getDefault('nameLabel') === 'string' ? String(getDefault('nameLabel')) : '');
    const emailLabelValue = typeof values.emailLabel === 'string' ? values.emailLabel : (typeof getDefault('emailLabel') === 'string' ? String(getDefault('emailLabel')) : '');
    const messageLabelValue = typeof values.messageLabel === 'string' ? values.messageLabel : (typeof getDefault('messageLabel') === 'string' ? String(getDefault('messageLabel')) : '');
    const submitLabelValue = typeof values.submitLabel === 'string' ? values.submitLabel : (typeof getDefault('submitLabel') === 'string' ? String(getDefault('submitLabel')) : '');

    const requireNameValue = typeof values.requireName === 'boolean' ? values.requireName : (typeof getDefault('requireName') === 'boolean' ? Boolean(getDefault('requireName')) : true);
    const requireEmailValue = typeof values.requireEmail === 'boolean' ? values.requireEmail : (typeof getDefault('requireEmail') === 'boolean' ? Boolean(getDefault('requireEmail')) : true);
    const requireMessageValue = typeof values.requireMessage === 'boolean' ? values.requireMessage : (typeof getDefault('requireMessage') === 'boolean' ? Boolean(getDefault('requireMessage')) : true);

    const defaultLiveMode = getDefault('liveMode');
    const liveModeValue = (values.liveMode === 'off' || values.liveMode === 'assertive')
        ? values.liveMode
        : (defaultLiveMode === 'off' || defaultLiveMode === 'assertive') ? defaultLiveMode as 'off' | 'assertive' : 'polite';

    const defaultSubmitAction = getDefault('submitAction');
    const submitActionValue = values.submitAction === 'event'
        ? 'event'
        : (defaultSubmitAction === 'event' ? 'event' : 'mailto');
    const mailtoValue = typeof values.mailtoTo === 'string' ? values.mailtoTo : (typeof getDefault('mailtoTo') === 'string' ? String(getDefault('mailtoTo')) : '');
    const successTextValue = typeof values.successText === 'string' ? values.successText : (typeof getDefault('successText') === 'string' ? String(getDefault('successText')) : '');
    const errorTextValue = typeof values.errorText === 'string' ? values.errorText : (typeof getDefault('errorText') === 'string' ? String(getDefault('errorText')) : '');

    const fontValue = isTextFontValue(values.font) ? values.font as TextFontOption : (isTextFontValue(getDefault('font')) ? getDefault('font') as TextFontOption : 'system');

    const fontSizeField = schemaFields.get('fontSize');
    const fontSizeMeta = fontSizeField instanceof z.ZodNumber ? deriveNumberBounds(fontSizeField as z.ZodNumber) : undefined;
    const minFontSize = fontSizeMeta?.min ?? 10;
    const maxFontSize = fontSizeMeta?.max ?? 72;
    const fontSizeStep = fontSizeMeta?.step ?? 1;
    const defaultFontSize = typeof getDefault('fontSize') === 'number' ? Number(getDefault('fontSize')) : 14;
    const customFontSize = typeof values.fontSize === 'number' && Number.isFinite(values.fontSize);
    const sliderFontSize = customFontSize ? Number(values.fontSize) : defaultFontSize;
    const fontSizeInputValue = customFontSize ? Number(values.fontSize) : '';

    const cardBackgroundValue = typeof values.cardBackgroundColor === 'string' ? values.cardBackgroundColor : (typeof getDefault('cardBackgroundColor') === 'string' ? String(getDefault('cardBackgroundColor')) : '');
    const cardBackgroundSwatch = HEX_COLOR_RE.test(cardBackgroundValue) ? cardBackgroundValue : '#ffffff';

    const fontOptions: Array<{ value: TextFontOption; label: string; sample: string }> = [
        { value: 'system', label: 'System', sample: 'Aa' },
        { value: 'serif', label: 'Serif', sample: 'Aa' },
        { value: 'mono', label: 'Mono', sample: '{ }' },
    ];

    const contactPreview = useMemo(() => {
        const trimmedHeading = headingValue.trim();
        const trimmedDescription = descriptionValue.trim();
        const trimmedNameLabel = nameLabelValue.trim();
        const trimmedEmailLabel = emailLabelValue.trim();
        const trimmedMessageLabel = messageLabelValue.trim();
        const trimmedSubmit = submitLabelValue.trim();
        const trimmedStatus = successTextValue.trim();
        const background = cardBackgroundValue?.trim().length ? cardBackgroundValue.trim() : 'var(--surface)';
        const fontFamily = fontValue === 'serif'
            ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
            : fontValue === 'mono'
                ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
        const fontSizePreview = customFontSize ? sliderFontSize : defaultFontSize;
        return {
            heading: trimmedHeading || 'Contact me',
            description: trimmedDescription || 'Add a friendly intro so visitors know what happens after they reach out.',
            nameLabel: trimmedNameLabel || 'Your name',
            emailLabel: trimmedEmailLabel || 'Your email',
            messageLabel: trimmedMessageLabel || 'Message',
            submitLabel: trimmedSubmit || 'Send',
            statusText: trimmedStatus || 'Thanks! Your message is ready to send.',
            background,
            fontFamily,
            fontSize: fontSizePreview,
        };
    }, [
        headingValue,
        descriptionValue,
        nameLabelValue,
        emailLabelValue,
        messageLabelValue,
        submitLabelValue,
        successTextValue,
        cardBackgroundValue,
        fontValue,
        customFontSize,
        sliderFontSize,
        defaultFontSize,
    ]);

    return (
        <div className="space-y-4">
            <SectionCard sectionKey="content" title="Content & labels" icon={<Mail size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_1fr]">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Heading</label>
                                <input
                                    className="input w-full"
                                    value={headingValue}
                                    maxLength={80}
                                    onChange={(e) => setFieldValue('heading', e.target.value)}
                                    onKeyDown={onCommitKeyDown}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1 flex items-center justify-between">
                                    <span>{headingValue.length}/80 characters</span>
                                    <span>Primary title shown above the form.</span>
                                </div>
                                {errors.heading && <div className="text-xs text-red-500 mt-1">{errors.heading}</div>}
                            </div>
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Subheading</label>
                                <textarea
                                    className="input w-full min-h-[4.5rem]"
                                    value={descriptionValue}
                                    onChange={(e) => setFieldValue('description', e.target.value)}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1 flex items-center justify-between">
                                    <span>{descriptionValue.length} characters</span>
                                    <span>Shown directly under the heading.</span>
                                </div>
                                {errors.description && <div className="text-xs text-red-500 mt-1">{errors.description}</div>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Name label</label>
                                <input
                                    className="input w-full"
                                    value={nameLabelValue}
                                    maxLength={60}
                                    onChange={(e) => setFieldValue('nameLabel', e.target.value)}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Label displayed above the name input.</div>
                                {errors.nameLabel && <div className="text-xs text-red-500 mt-1">{errors.nameLabel}</div>}
                            </div>
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Email label</label>
                                <input
                                    className="input w-full"
                                    value={emailLabelValue}
                                    maxLength={60}
                                    onChange={(e) => setFieldValue('emailLabel', e.target.value)}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Label displayed above the email input.</div>
                                {errors.emailLabel && <div className="text-xs text-red-500 mt-1">{errors.emailLabel}</div>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Message label</label>
                                <input
                                    className="input w-full"
                                    value={messageLabelValue}
                                    maxLength={60}
                                    onChange={(e) => setFieldValue('messageLabel', e.target.value)}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Appears above the message textarea.</div>
                                {errors.messageLabel && <div className="text-xs text-red-500 mt-1">{errors.messageLabel}</div>}
                            </div>
                            <div>
                                <label className="block text-[color:var(--fg-muted)] mb-1">Submit button label</label>
                                <input
                                    className="input w-full"
                                    value={submitLabelValue}
                                    maxLength={40}
                                    onChange={(e) => setFieldValue('submitLabel', e.target.value)}
                                    disabled={locked}
                                />
                                <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Text shown on the call-to-action button.</div>
                                {errors.submitLabel && <div className="text-xs text-red-500 mt-1">{errors.submitLabel}</div>}
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/75 p-3 shadow-sm">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)] mb-2">
                            <span>Preview</span>
                            <Palette size={12} />
                        </div>
                        <div className="widget-contact select-none" style={{ pointerEvents: 'none' }} aria-hidden="true">
                            <div className="contact-card" style={{ background: contactPreview.background }}>
                                <form
                                    className="contact-form"
                                    style={{ fontFamily: contactPreview.fontFamily, fontSize: `${contactPreview.fontSize}px` }}
                                    onSubmit={(e) => e.preventDefault()}
                                >
                                    {contactPreview.heading && <h3 className="contact-heading">{contactPreview.heading}</h3>}
                                    {contactPreview.description && <p className="contact-description">{contactPreview.description}</p>}
                                    <div className="contact-field">
                                        <label>{contactPreview.nameLabel}</label>
                                        <input readOnly tabIndex={-1} placeholder="Alex Builder" />
                                    </div>
                                    <div className="contact-field">
                                        <label>{contactPreview.emailLabel}</label>
                                        <input readOnly tabIndex={-1} placeholder="you@example.com" />
                                    </div>
                                    <div className="contact-field">
                                        <label>{contactPreview.messageLabel}</label>
                                        <textarea readOnly tabIndex={-1} placeholder="Tell me about your project" />
                                    </div>
                                    <div className="contact-actions">
                                        <button type="button" tabIndex={-1}>{contactPreview.submitLabel}</button>
                                    </div>
                                    <div className="contact-status is-visible">{contactPreview.statusText}</div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="validation" title="Validation & feedback" icon={<Shield size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                        { key: 'requireName', label: 'Require name', value: requireNameValue },
                        { key: 'requireEmail', label: 'Require email', value: requireEmailValue },
                        { key: 'requireMessage', label: 'Require message', value: requireMessageValue },
                    ] as Array<{ key: 'requireName' | 'requireEmail' | 'requireMessage'; label: string; value: boolean }>).map((toggle) => (
                        <button
                            key={toggle.key}
                            type="button"
                            className={`px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${toggle.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                            onClick={() => setFieldValue(toggle.key, !toggle.value)}
                            disabled={locked}
                            aria-pressed={toggle.value}
                        >
                            {toggle.label}
                        </button>
                    ))}
                </div>
                <div className="text-[11px] text-[color:var(--fg-muted)]">Control which inputs visitors must complete before they can submit.</div>
            </SectionCard>

            <SectionCard sectionKey="submission" title="Submission behavior" icon={<SlidersHorizontal size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-2">
                    <label className="block text-[color:var(--fg-muted)] mb-1">Action</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {SUBMIT_ACTION_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`text-left px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${submitActionValue === option.value ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                onClick={() => setFieldValue('submitAction', option.value)}
                                disabled={locked}
                                aria-pressed={submitActionValue === option.value}
                            >
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
                {submitActionValue === 'mailto' && (
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Destination email</label>
                        <input
                            className="input w-full"
                            type="email"
                            placeholder="you@example.com"
                            value={mailtoValue}
                            onChange={(e) => setFieldValue('mailtoTo', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Used to build the mailto link when visitors submit.</div>
                        {errors.mailtoTo && <div className="text-xs text-red-500 mt-1">{errors.mailtoTo}</div>}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Success message</label>
                        <textarea
                            className="input w-full min-h-[3rem]"
                            value={successTextValue}
                            onChange={(e) => setFieldValue('successText', e.target.value)}
                            disabled={locked}
                        />
                        {errors.successText && <div className="text-xs text-red-500 mt-1">{errors.successText}</div>}
                    </div>
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Error message</label>
                        <textarea
                            className="input w-full min-h-[3rem]"
                            value={errorTextValue}
                            onChange={(e) => setFieldValue('errorText', e.target.value)}
                            disabled={locked}
                        />
                        {errors.errorText && <div className="text-xs text-red-500 mt-1">{errors.errorText}</div>}
                    </div>
                </div>
            </SectionCard>

            <SectionCard sectionKey="typography" title="Typography & layout" icon={<AlignLeft size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
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
                            onChange={(e) => setFieldValue('fontSize', e.target.value === '' ? undefined : Number(e.target.value))}
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
                <div>
                    <label className="block text-[color:var(--fg-muted)] mb-1">Card background</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="color"
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 h-8 w-12 cursor-pointer"
                            value={cardBackgroundSwatch}
                            onChange={(e) => setFieldValue('cardBackgroundColor', e.target.value)}
                            disabled={locked}
                            aria-label="Card background color"
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={cardBackgroundValue}
                            placeholder="var(--surface)"
                            onChange={(e) => setFieldValue('cardBackgroundColor', e.target.value)}
                            onKeyDown={onCommitKeyDown}
                            disabled={locked}
                        />
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                            onClick={() => setFieldValue('cardBackgroundColor', undefined)}
                            disabled={locked || !cardBackgroundValue}
                        >
                            Reset
                        </button>
                    </div>
                    <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Leave blank to inherit the theme color or use CSS variables like var(--surface).</div>
                    {errors.cardBackgroundColor && <div className="text-xs text-red-500 mt-1">{errors.cardBackgroundColor}</div>}
                </div>
            </SectionCard>

            <SectionCard sectionKey="accessibility" title="Accessibility" icon={<Sparkles size={14} />} sectionsOpen={sectionsOpen} toggleSection={toggleSection}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Live region mode</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {LIVE_MODE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`text-left px-3 py-2 rounded border text-sm font-semibold transition-colors duration-150 ${liveModeValue === option.value ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                    onClick={() => setFieldValue('liveMode', option.value)}
                                    disabled={locked}
                                    aria-pressed={liveModeValue === option.value}
                                >
                                    <div className="text-sm font-semibold">{option.label}</div>
                                    <div className="text-[11px] text-[color:var(--fg-muted)]/90">{option.description}</div>
                                </button>
                            ))}
                        </div>
                        <div className="text-[10px] text-[color:var(--fg-muted)] mt-1">Controls how success or error states announce to assistive technology.</div>
                        {errors.liveMode && <div className="text-xs text-red-500 mt-1">{errors.liveMode}</div>}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
