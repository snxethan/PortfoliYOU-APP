import React, { useEffect, useState } from "react";
import { Layers, Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, X } from "lucide-react";
import { z } from "zod";

import { WidgetsRegistry } from "../../../widgets/registry";
import type { GridItem } from "../DraggableItem";

export default function ModifyWidgetModal({
    item,
    onClose,
    onRename,
    onBringToFront,
    onSendToBack,
    onBringForward,
    onSendBackward,
    onTogglePin,
    onToggleLock,
    onApplyProps,
}: {
    item: GridItem;
    onClose: () => void;
    onRename: (title: string) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onTogglePin: () => void;
    onToggleLock: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onApplyProps: (props: any) => void;
}) {
    const [title, setTitle] = useState(item.title);
    const [propsText, setPropsText] = useState<string>(() => {
        try { return JSON.stringify(item.props ?? {}, null, 2); } catch { return "{}"; }
    });
    const [propsError, setPropsError] = useState<string | null>(null);
    const [zodSchema, setZodSchema] = useState<z.ZodObject<z.ZodRawShape> | null>(null);
    const [formValues, setFormValues] = useState<Record<string, unknown>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setTitle(item.title);
        try { setPropsText(JSON.stringify(item.props ?? {}, null, 2)); } catch { setPropsText("{}"); }
        setPropsError(null);
        // Load widget definition to check for zod schema
        let mounted = true;
        if (!item.type) { setZodSchema(null); return () => { }; }
        WidgetsRegistry.ensure(item.type as string)
            .then((def) => {
                if (!mounted) return;
                const schema = (def as unknown as { zodSchema?: z.ZodObject<z.ZodRawShape> }).zodSchema;
                setZodSchema(schema ?? null);
                if (schema) {
                    // Initialize form values from current props with defaults for missing keys
                    const shape = schema.shape;
                    const initial: Record<string, unknown> = {};
                    for (const key of Object.keys(shape)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const current = (item.props as any)?.[key];
                        initial[key] = current !== undefined ? current : undefined;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setFormValues({ ...initial, ...(item.props as any) });
                    // Validate once to populate errors
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const res = schema.safeParse({ ...initial, ...(item.props as any) });
                    if (!res.success) {
                        const errs: Record<string, string> = {};
                        for (const issue of res.error.issues) {
                            if (issue.path && issue.path.length > 0) {
                                errs[String(issue.path[0])] = issue.message;
                            }
                        }
                        setFormErrors(errs);
                    } else {
                        setFormErrors({});
                    }
                } else {
                    setFormValues({});
                    setFormErrors({});
                }
            })
            .finally(() => { });
        return () => { mounted = false; };
    }, [item]);

    const locked = !!item.locked;
    const pinned = !!item.pinned;

    function applyProps() {
        if (locked) return;
        try {
            const parsed = JSON.parse(propsText);
            setPropsError(null);
            onApplyProps(parsed);
        } catch {
            setPropsError("Invalid JSON");
        }
    }

    function applyForm() {
        if (locked || !zodSchema) return;
        const parsed = zodSchema.safeParse(formValues);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path && issue.path.length > 0) {
                    errs[String(issue.path[0])] = issue.message;
                }
            }
            setFormErrors(errs);
            return;
        }
        setFormErrors({});
        onApplyProps(parsed.data);
    }

    const pinDisabled = locked;

    return (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
        >
            <div
                className="surface p-5 w-full max-w-4xl border border-[color:var(--border)] rounded-md max-h-[85vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-center mb-3 relative">
                    <button className="btn btn-ghost btn-xs absolute right-0 top-0" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Layers size={16} /> Modify Widget
                    </div>
                </div>

                <div className="space-y-5 text-sm">
                    {/* Properties (zod-backed) */}
                    {zodSchema && (
                        <div className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--muted)]/40">
                            <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Properties</div>
                            <div className="space-y-2">
                                {Object.entries(zodSchema.shape).map(([key, schema]) => {
                                    const field = schema as z.ZodTypeAny;
                                    const isOptional = field instanceof z.ZodOptional;
                                    // Unwrap optional
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const baseField = isOptional ? (field._def as any).innerType as z.ZodTypeAny : field;
                                    const value = (formValues[key] as string | number | boolean | undefined) ?? '';
                                    const error = formErrors[key];
                                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                                    const disabled = locked;
                                    const common = {
                                        value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                            const tgt = e.target;
                                            const v: unknown = tgt.type === 'checkbox' ? tgt.checked : tgt.value;
                                            const next: Record<string, unknown> = { ...formValues, [key]: baseField instanceof z.ZodNumber ? ((v as string) === '' ? undefined : Number(v)) : v };
                                            setFormValues(next);
                                            // run live validation per key
                                            if (zodSchema) {
                                                const single = z.object({ [key]: (schema as z.ZodTypeAny) });
                                                const res = single.safeParse({ [key]: next[key] });
                                                setFormErrors({ ...formErrors, [key]: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') });
                                            }
                                        }, disabled
                                    };
                                    return (
                                        <div key={key}>
                                            <label className="block text-[color:var(--fg-muted)] mb-1">{label}{!isOptional ? ' *' : ''}</label>
                                            {baseField instanceof z.ZodBoolean ? (
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" className="checkbox" checked={!!formValues[key]} onChange={common.onChange} disabled={disabled} />
                                                    <span className="text-xs">{label}</span>
                                                </div>
                                            ) : baseField instanceof z.ZodNumber ? (
                                                <input className="input w-full" type="number" value={String(value ?? '')} onChange={common.onChange} disabled={disabled} />
                                            ) : (
                                                <input
                                                    className="input w-full"
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    type={(baseField as any)._def?.checks?.some?.((c: any) => c?.kind === 'email') ? 'email' :
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        (baseField as any)._def?.checks?.some?.((c: any) => c?.kind === 'url') ? 'url' : 'text'}
                                                    value={String(value ?? '')}
                                                    onChange={common.onChange}
                                                    disabled={disabled}
                                                />
                                            )}
                                            {!!error && <div className="mt-1 text-xs text-red-500">{error}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <button className="btn btn-outline btn-xs" onClick={() => { applyForm(); if (!locked && Object.values(formErrors).every((e) => !e)) onClose(); }} disabled={locked}>Apply</button>
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-[color:var(--fg-muted)] mb-1">Name</label>
                        <input
                            className="input w-full"
                            value={title}
                            disabled={locked}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={() => {
                                const v = title.trim();
                                if (!locked && v && v !== item.title) onRename(v);
                            }}
                        />
                    </div>

                    {/* Protection section */}
                    <div className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--muted)]/40">
                        <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Protection</div>
                        <div className="flex items-center gap-2">
                            <button
                                className={`btn btn-ghost flex items-center gap-2 ${pinDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => { if (!pinDisabled) onTogglePin(); }}
                                title={pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
                                disabled={pinDisabled}
                            >
                                {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                                <span>{pinned ? 'Pinned' : 'Pin'}</span>
                            </button>
                            <button
                                className="btn btn-ghost flex items-center gap-2"
                                onClick={onToggleLock}
                                title={locked ? 'Unlock (allow modify)' : 'Lock (prevent modify)'}
                            >
                                {locked ? <Lock size={16} /> : <Unlock size={16} />}
                                <span>{locked ? 'Locked' : 'Lock'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Layer order */}
                    <div className="border border-[color:var(--border)] rounded-md p-3">
                        <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Layer order</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="btn btn-ghost flex items-center gap-2" onClick={onBringToFront} disabled={locked} title="Bring to front">
                                <ChevronsUp size={16} /> Bring to front
                            </button>
                            <button className="btn btn-ghost flex items-center gap-2" onClick={onSendToBack} disabled={locked} title="Send to back">
                                <ChevronsDown size={16} /> Send to back
                            </button>
                            <button className="btn btn-ghost flex items-center gap-2" onClick={onBringForward} disabled={locked} title="Move up one layer">
                                <ChevronUp size={16} /> Move up
                            </button>
                            <button className="btn btn-ghost flex items-center gap-2" onClick={onSendBackward} disabled={locked} title="Move down one layer">
                                <ChevronDown size={16} /> Move down
                            </button>
                        </div>
                    </div>

                    {/* Widget info */}
                    <div>
                        <div className="text-[color:var(--fg-muted)] mb-1">Type</div>
                        <div className="font-mono text-xs px-2 py-1 rounded bg-[color:var(--muted)]/40 border border-[color:var(--border)] inline-block">
                            {item.type ?? 'unknown'}
                        </div>
                    </div>

                    {/* JSON settings */}
                    <div className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--muted)]/40">
                        <label className="block text-[color:var(--fg-muted)] mb-1">Advanced: Raw JSON settings</label>
                        <textarea
                            className="input w-full font-mono min-h-[10rem]"
                            value={propsText}
                            disabled={locked}
                            onChange={(e) => setPropsText(e.target.value)}
                        />
                        {propsError && <div className="mt-1 text-xs text-red-500">{propsError}</div>}
                        <div className="mt-2 flex items-center justify-end gap-2">
                            <button className="btn btn-outline btn-xs" onClick={() => { applyProps(); if (!locked && !propsError) onClose(); }} disabled={locked}>Apply JSON</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
