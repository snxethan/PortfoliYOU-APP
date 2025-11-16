import React, { useEffect, useState } from "react";
import { Layers, Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, X } from "lucide-react";
import { z } from "zod";

import { WidgetsRegistry } from "../../../widgets/registry";
import type { GridItem } from "../canvas/DraggableItem";
import { useAssets } from "../../../providers/AssetsProvider";

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
    const [defType, setDefType] = useState<string | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>("");
    const assets = useAssets();

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
                try { setDefType((def as unknown as { type?: string }).type || item.type || null); } catch { setDefType(item.type || null); }
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

    // Initialize/refresh chosen file label from current src when editing an image widget
    useEffect(() => {
        let alive = true;
        async function go() {
            if (defType !== 'image') return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const src = (formValues as any)?.src as unknown;
            if (typeof src === 'string' && src.startsWith('asset://')) {
                const hash = src.slice('asset://'.length);
                try { const meta = await assets.get(hash); if (alive) setSelectedFileName(meta?.name || ''); } catch { /* ignore */ }
            } else {
                if (alive) setSelectedFileName('');
            }
        }
        void go();
        return () => { alive = false; };
    }, [defType, formValues, assets]);

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
                    {/* Image quick upload (when editing Image widget) */}
                    {defType === 'image' && (
                        <div className="border border-[color:var(--border)] rounded-md p-3 bg-[color:var(--muted)]/30">
                            <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Image</div>
                            <div className="flex items-center gap-3 text-xs">
                                <label className={`inline-flex items-center justify-center px-3 py-2 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <span className="font-medium">Choose image</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={locked}
                                        onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) { setSelectedFileName(""); return; }
                                            setSelectedFileName(f.name);
                                            try {
                                                // Store in local asset store and reference via asset://hash
                                                const metas = await assets.addFiles([f]);
                                                const m = metas[0];
                                                if (m?.hash) {
                                                    const next = { ...formValues, src: `asset://${m.hash}` } as Record<string, unknown>;
                                                    setFormValues(next);
                                                    if (zodSchema && zodSchema.shape?.src) {
                                                        const shape = zodSchema.shape as Record<string, z.ZodTypeAny>;
                                                        const single = z.object({ src: shape['src'] as z.ZodTypeAny });
                                                        const res = single.safeParse({ src: next.src });
                                                        setFormErrors({ ...formErrors, src: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') });
                                                    }
                                                }
                                            } catch { /* ignore */ }
                                        }}
                                    />
                                </label>
                                <span className={`px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 ${selectedFileName ? '' : 'text-[color:var(--fg-muted)]/70'}`}>
                                    {selectedFileName || 'No file chosen'}
                                </span>
                            </div>
                            {/* Choose from existing assets */}
                            <div className="mt-3 text-xs flex items-center gap-2">
                                <span className="text-[color:var(--fg-muted)]">Or pick from assets:</span>
                                <select
                                    className="input"
                                    disabled={locked}
                                    value={(() => {
                                        // reflect current src if it's an asset
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        const src = (formValues as any)?.src as unknown;
                                        if (typeof src === 'string' && src.startsWith('asset://')) return src.slice('asset://'.length);
                                        return '';
                                    })()}
                                    onChange={async (e) => {
                                        const hash = e.target.value;
                                        if (!hash) return;
                                        const next = { ...formValues, src: `asset://${hash}` } as Record<string, unknown>;
                                        setFormValues(next);
                                        try { const meta = await assets.get(hash); setSelectedFileName(meta?.name || ''); } catch { /* noop */ }
                                        if (zodSchema && zodSchema.shape?.src) {
                                            const shape = zodSchema.shape as Record<string, z.ZodTypeAny>;
                                            const single = z.object({ src: shape['src'] as z.ZodTypeAny });
                                            const res = single.safeParse({ src: next.src });
                                            setFormErrors({ ...formErrors, src: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') });
                                        }
                                    }}
                                >
                                    <option value="">Select an asset…</option>
                                    {assets.list.map((a) => (
                                        <option key={a.hash} value={a.hash}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

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
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const anyZ: any = z;
                                    const isEnum = baseField instanceof anyZ.ZodEnum;
                                    const isNativeEnum = baseField instanceof anyZ.ZodNativeEnum;
                                    const isColorField = typeof value === 'string' && key.toLowerCase().includes('color');
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
                                            ) : (isEnum || isNativeEnum) ? (
                                                <select
                                                    className="input w-full"
                                                    value={String(value || '')}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        const next: Record<string, unknown> = { ...formValues, [key]: v };
                                                        setFormValues(next);
                                                        if (zodSchema) {
                                                            const single = z.object({ [key]: (schema as z.ZodTypeAny) });
                                                            const res = single.safeParse({ [key]: next[key] });
                                                            setFormErrors({ ...formErrors, [key]: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') });
                                                        }
                                                    }}
                                                    disabled={disabled}
                                                >
                                                    <option value="" disabled>Select…</option>
                                                    {(() => {
                                                        // derive options for enum types
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        const def: any = (baseField as any)._def;
                                                        let opts: string[] = [];
                                                        if (isEnum && Array.isArray(def?.values)) opts = def.values as string[];
                                                        else if (isNativeEnum && def?.values) opts = Object.values(def.values).filter((v: unknown) => typeof v === 'string') as string[];
                                                        return opts.map((opt) => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ));
                                                    })()}
                                                </select>
                                            ) : (
                                                <input
                                                    className="input w-full"
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    type={isColorField ? 'color' : (baseField as any)._def?.checks?.some?.((c: any) => c?.kind === 'email') ? 'email' :
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
