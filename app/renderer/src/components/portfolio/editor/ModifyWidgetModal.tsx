import React, { useEffect, useMemo, useState } from "react";
import { Layers, Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, X } from "lucide-react";
import type { GridItem } from "./DraggableItem";

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
    onApplyProps: (props: any) => void;
}) {
    const [title, setTitle] = useState(item.title);
    const [propsText, setPropsText] = useState<string>(() => {
        try { return JSON.stringify(item.props ?? {}, null, 2); } catch { return "{}"; }
    });
    const [propsError, setPropsError] = useState<string | null>(null);

    useEffect(() => {
        setTitle(item.title);
        try { setPropsText(JSON.stringify(item.props ?? {}, null, 2)); } catch { setPropsText("{}"); }
        setPropsError(null);
    }, [item]);

    const locked = !!item.locked;
    const pinned = !!item.pinned;

    function applyProps() {
        if (locked) return;
        try {
            const parsed = JSON.parse(propsText);
            setPropsError(null);
            onApplyProps(parsed);
        } catch (e) {
            setPropsError("Invalid JSON");
        }
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
                        <label className="block text-[color:var(--fg-muted)] mb-1">Widget settings (JSON)</label>
                        <textarea
                            className="input w-full font-mono min-h-[10rem]"
                            value={propsText}
                            disabled={locked}
                            onChange={(e) => setPropsText(e.target.value)}
                        />
                        {propsError && <div className="mt-1 text-xs text-red-500">{propsError}</div>}
                        <div className="mt-2 flex items-center justify-end gap-2">
                            <button className="btn btn-outline btn-xs" onClick={() => { applyProps(); if (!locked && !propsError) onClose(); }} disabled={locked}>Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
