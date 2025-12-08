import React, { useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { useWidget } from '../sdk';
import type { WidgetDefinition } from '../types';

type LiveMode = 'off' | 'polite' | 'assertive';
type SubmitAction = 'mailto' | 'event';
type FontChoice = 'system' | 'serif' | 'mono';

type ContactProps = {
    heading?: string;
    description?: string;
    nameLabel?: string;
    emailLabel?: string;
    messageLabel?: string;
    submitLabel?: string;
    requireName?: boolean;
    requireEmail?: boolean;
    requireMessage?: boolean;
    ariaLabel?: string;
    ariaDescription?: string;
    liveMode?: LiveMode;
    submitAction?: SubmitAction;
    mailtoTo?: string;
    successText?: string;
    errorText?: string;
    font?: FontChoice;
    fontSize?: number;
    cardBackgroundColor?: string;
};

const def: WidgetDefinition<ContactProps> = {
    type: 'contact',
    label: 'Contact Form',
    version: 1,
    defaultProps: {
        heading: 'Contact me',
        description: '',
        nameLabel: 'Your name',
        emailLabel: 'Your email',
        messageLabel: 'Message',
        submitLabel: 'Send',
        requireName: true,
        requireEmail: true,
        requireMessage: true,
        ariaLabel: '',
        ariaDescription: '',
        liveMode: 'polite',
        submitAction: 'mailto',
        mailtoTo: '',
        successText: 'Thanks! Your message is ready to send.',
        errorText: 'Please fix the errors below.',
        font: 'system',
        fontSize: undefined,
    },
    grid: { w: 6, h: 4 },
    render: (props) => {
        function ContactForm(p: ContactProps) {
            const { editing, interactive } = useWidget();
            const [name, setName] = useState('');
            const [email, setEmail] = useState('');
            const [message, setMessage] = useState('');
            const [status, setStatus] = useState<string>('');
            const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

            const emailRe = useMemo(() => /.+@.+\..+/, []);
            const live = p.liveMode && p.liveMode !== 'off' ? p.liveMode : undefined;

            const nameRef = useRef<HTMLInputElement | null>(null);
            const emailRef = useRef<HTMLInputElement | null>(null);
            const messageRef = useRef<HTMLTextAreaElement | null>(null);
            const generatedId = useId();
            const nameId = `${generatedId}-contact-name`;
            const emailId = `${generatedId}-contact-email`;
            const messageId = `${generatedId}-contact-message`;
            const descId = (p.description || p.ariaDescription) ? `${generatedId}-contact-desc` : undefined;

            function focusFirstInvalid() {
                if (errors.name) { nameRef.current?.focus(); return; }
                if (errors.email) { emailRef.current?.focus(); return; }
                if (errors.message) { messageRef.current?.focus(); return; }
            }

            function validate(): boolean {
                const next: { name?: string; email?: string; message?: string } = {};
                if (p.requireName && !name.trim()) next.name = 'Name is required';
                if (p.requireEmail) {
                    if (!email.trim()) next.email = 'Email is required';
                    else if (!emailRe.test(email)) next.email = 'Enter a valid email';
                } else if (email && !emailRe.test(email)) next.email = 'Enter a valid email';
                if (p.requireMessage && !message.trim()) next.message = 'Message is required';
                setErrors(next);
                return Object.keys(next).length === 0;
            }

            function doSubmit(e: React.FormEvent) {
                e.preventDefault();
                setStatus('');
                if (!validate()) { setStatus(p.errorText || 'Please fix the errors below.'); focusFirstInvalid(); return; }
                if ((p.submitAction || 'mailto') === 'event') {
                    window.dispatchEvent(new CustomEvent('py:contactSubmit', { detail: { name, email, message } }));
                    setStatus(p.successText || 'Thanks! Your message is ready to send.');
                    return;
                }
                // mailto flow
                const to = (p.mailtoTo || '').trim();
                const subject = encodeURIComponent(`Contact from ${name || 'visitor'}`);
                const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
                const url = `mailto:${to}?subject=${subject}&body=${body}`;
                try { window.open(url, '_blank'); } catch { /* ignore */ }
                setStatus(p.successText || 'Thanks! Your message is ready to send.');
            }

            const lockedUI = editing || !interactive;
            const ff = p.font === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
                : p.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                    : 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
            const cardBackground = typeof p.cardBackgroundColor === 'string' && p.cardBackgroundColor.trim().length > 0 ? p.cardBackgroundColor.trim() : undefined;
            const idSuffix = generatedId.replace(/[^a-zA-Z0-9]/g, '') || 'contact';

            const renderFieldError = (field: 'name' | 'email' | 'message', errorId: string) => {
                const messageValue = errors[field];
                return (
                    <div
                        id={errorId}
                        className="contact-error"
                        data-error={field}
                        role={messageValue ? 'alert' : undefined}
                        aria-live={messageValue ? 'assertive' : undefined}
                    >
                        {messageValue || ''}
                    </div>
                );
            };

            const formNode = (
                <form
                    className="contact-form"
                    onSubmit={doSubmit}
                    aria-describedby={descId}
                    aria-label={p.ariaLabel || undefined}
                    aria-disabled={lockedUI || undefined}
                    style={{ pointerEvents: lockedUI ? 'none' : undefined, fontFamily: ff, fontSize: p.fontSize ? `${p.fontSize}px` : undefined }}
                    data-contact-widget="true"
                    data-submit-action={p.submitAction || 'mailto'}
                    data-require-name={String(p.requireName !== false)}
                    data-require-email={String(p.requireEmail !== false)}
                    data-require-message={String(p.requireMessage !== false)}
                    data-mailto-to={p.mailtoTo || ''}
                    data-success-text={p.successText || 'Thanks! Your message is ready to send.'}
                    data-error-text={p.errorText || 'Please fix the errors below.'}
                >
                    {p.heading && <h3 className="contact-heading">{p.heading}</h3>}
                    {(p.description || p.ariaDescription) && (
                        p.description ? (
                            <p id={descId} className="contact-description">{p.description}</p>
                        ) : (
                            <p id={descId} className="sr-only">{p.ariaDescription}</p>
                        )
                    )}
                    <div className="contact-field">
                        <label htmlFor={nameId}>{p.nameLabel || 'Your name'}</label>
                        <input
                            id={nameId}
                            name={`contact-name-${idSuffix}`}
                            data-nodrag="true"
                            ref={nameRef}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={lockedUI}
                            aria-invalid={!!errors.name}
                            aria-errormessage={errors.name ? `${nameId}-error` : undefined}
                        />
                        {renderFieldError('name', `${nameId}-error`)}
                    </div>
                    <div className="contact-field">
                        <label htmlFor={emailId}>{p.emailLabel || 'Your email'}</label>
                        <input
                            id={emailId}
                            name={`contact-email-${idSuffix}`}
                            data-nodrag="true"
                            ref={emailRef}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={lockedUI}
                            aria-invalid={!!errors.email}
                            aria-errormessage={errors.email ? `${emailId}-error` : undefined}
                        />
                        {renderFieldError('email', `${emailId}-error`)}
                    </div>
                    <div className="contact-field">
                        <label htmlFor={messageId}>{p.messageLabel || 'Message'}</label>
                        <textarea
                            id={messageId}
                            name={`contact-message-${idSuffix}`}
                            data-nodrag="true"
                            ref={messageRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={lockedUI}
                            aria-invalid={!!errors.message}
                            aria-errormessage={errors.message ? `${messageId}-error` : undefined}
                        />
                        {renderFieldError('message', `${messageId}-error`)}
                    </div>
                    <div className="contact-actions">
                        <button
                            type="submit"
                            disabled={lockedUI}
                            aria-label={p.submitLabel || 'Send'}
                        >
                            {p.submitLabel || 'Send'}
                        </button>
                        {live && (
                            <span role="status" aria-live={live} className="sr-only">{status || 'Ready'}</span>
                        )}
                    </div>
                    {!live && (
                        <div className={`contact-status${status ? ' is-visible' : ''}`} data-contact-status>
                            {status}
                        </div>
                    )}
                </form>
            );

            return (
                <div className="widget-contact h-full w-full min-h-0">
                    <div
                        className="contact-card"
                        style={{ background: cardBackground || undefined }}
                    >
                        {formNode}
                    </div>
                </div>
            );
        }

        return <ContactForm {...props} />;
    },
    zodSchema: z.object({
        heading: z.string().optional(),
        description: z.string().optional(),
        nameLabel: z.string().optional(),
        emailLabel: z.string().optional(),
        messageLabel: z.string().optional(),
        submitLabel: z.string().optional(),
        requireName: z.boolean().optional(),
        requireEmail: z.boolean().optional(),
        requireMessage: z.boolean().optional(),
        ariaLabel: z.string().optional(),
        ariaDescription: z.string().optional(),
        liveMode: z.enum(['off', 'polite', 'assertive']).optional(),
        submitAction: z.enum(['mailto', 'event']).optional(),
        mailtoTo: z.string().email('Enter a valid email').or(z.literal('')).optional(),
        successText: z.string().optional(),
        errorText: z.string().optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
        cardBackgroundColor: z.string().max(120).optional(),
    }),
};

export default def;
