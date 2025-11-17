import React, { useMemo, useRef, useState } from 'react';
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
    ariaDescription?: string;
    liveMode?: LiveMode;
    submitAction?: SubmitAction;
    mailtoTo?: string;
    successText?: string;
    errorText?: string;
    font?: FontChoice;
    fontSize?: number;
};

const def: WidgetDefinition<ContactProps> = {
    type: 'contact',
    label: 'Contact Form',
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
            return (
                <form
                    className="space-y-2 text-xs"
                    onSubmit={doSubmit}
                    aria-describedby={p.ariaDescription ? 'contact-desc' : undefined}
                    aria-disabled={lockedUI || undefined}
                    style={{ pointerEvents: lockedUI ? 'none' : undefined, fontFamily: ff, fontSize: p.fontSize ? `${p.fontSize}px` : undefined }}
                >
                    {p.heading && <h3 className="text-sm font-semibold text-[color:var(--fg)]">{p.heading}</h3>}
                    {(p.description || p.ariaDescription) && (
                        <p id="contact-desc" className={p.ariaDescription ? 'sr-only' : ''}>
                            {p.description || p.ariaDescription}
                        </p>
                    )}
                    <div>
                        <label className="block mb-1" htmlFor="contact-name">{p.nameLabel || 'Your name'}</label>
                        <input
                            id="contact-name"
                            data-nodrag="true"
                            ref={nameRef}
                            className={`input w-full ${errors.name ? 'ring-1 ring-red-500' : ''}`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={editing || !interactive}
                            aria-invalid={!!errors.name}
                            aria-errormessage={errors.name ? 'contact-name-error' : undefined}
                        />
                        {errors.name && <div id="contact-name-error" className="mt-1 text-[11px] text-red-600" role="alert">{errors.name}</div>}
                    </div>
                    <div>
                        <label className="block mb-1" htmlFor="contact-email">{p.emailLabel || 'Your email'}</label>
                        <input
                            id="contact-email"
                            data-nodrag="true"
                            ref={emailRef}
                            className={`input w-full ${errors.email ? 'ring-1 ring-red-500' : ''}`}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={editing || !interactive}
                            aria-invalid={!!errors.email}
                            aria-errormessage={errors.email ? 'contact-email-error' : undefined}
                        />
                        {errors.email && <div id="contact-email-error" className="mt-1 text-[11px] text-red-600" role="alert">{errors.email}</div>}
                    </div>
                    <div>
                        <label className="block mb-1" htmlFor="contact-message">{p.messageLabel || 'Message'}</label>
                        <textarea
                            id="contact-message"
                            data-nodrag="true"
                            ref={messageRef}
                            className={`input w-full h-24 ${errors.message ? 'ring-1 ring-red-500' : ''}`}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={editing || !interactive}
                            aria-invalid={!!errors.message}
                            aria-errormessage={errors.message ? 'contact-message-error' : undefined}
                        />
                        {errors.message && <div id="contact-message-error" className="mt-1 text-[11px] text-red-600" role="alert">{errors.message}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={editing || !interactive} aria-label={p.submitLabel || 'Send'}>{p.submitLabel || 'Send'}</button>
                        {live && (
                            <span role="status" aria-live={live} className="sr-only">{status || 'Ready'}</span>
                        )}
                    </div>
                    {!live && status && (
                        <div className="text-[11px] text-[color:var(--fg-muted)]">{status}</div>
                    )}
                </form>
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
        ariaDescription: z.string().optional(),
        liveMode: z.enum(['off', 'polite', 'assertive']).optional(),
        submitAction: z.enum(['mailto', 'event']).optional(),
        mailtoTo: z.string().email('Enter a valid email').or(z.literal('')).optional(),
        successText: z.string().optional(),
        errorText: z.string().optional(),
        font: z.enum(['system', 'serif', 'mono']).optional(),
        fontSize: z.number().min(8).max(128).optional(),
    }),
};

export default def;
