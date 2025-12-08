import React, { useMemo } from 'react';

import type { AssetsCtx } from '../../providers/AssetsProvider';

export type AssetKind = 'image' | 'video' | 'media';

type SchemaAssetFieldProps = {
    value: string;
    placeholder: string;
    disabled: boolean;
    assets: AssetsCtx;
    assetKind: AssetKind;
    onChange: (value?: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function SchemaAssetField({ value, placeholder, disabled, assets, assetKind, onChange, onKeyDown }: SchemaAssetFieldProps) {
    const filteredAssets = useMemo(() => {
        return assets.list.filter((asset) => {
            if (!asset.type) return true;
            if (assetKind === 'video') return asset.type.startsWith('video/');
            if (assetKind === 'image') return asset.type.startsWith('image/');
            return true;
        });
    }, [assets.list, assetKind]);
    const assetHash = value.startsWith('asset://') ? value.slice('asset://'.length) : '';
    const currentAsset = assetHash ? assets.list.find((asset) => asset.hash === assetHash) : null;
    const accept = assetKind === 'image' ? 'image/*' : assetKind === 'video' ? 'video/*' : '*/*';
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className={`inline-flex items-center justify-center px-3 py-1.5 rounded border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/40 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className="font-semibold">Upload</span>
                    <input
                        type="file"
                        accept={accept}
                        className="sr-only"
                        disabled={disabled}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                                const metas = await assets.addFiles([file]);
                                const meta = metas[0];
                                if (meta?.hash) onChange(`asset://${meta.hash}`);
                            } catch (err) {
                                console.error('Asset upload failed', err);
                            }
                        }}
                    />
                </label>
                <span className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--muted)]/20 text-[color:var(--fg-muted)]">
                    {currentAsset?.name ?? (assetHash ? `asset://${assetHash}` : 'No asset selected')}
                </span>
            </div>
            {filteredAssets.length > 0 && (
                <select
                    className="input w-full"
                    value={assetHash}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value ? `asset://${e.target.value}` : undefined)}
                >
                    <option value="">Select asset…</option>
                    {filteredAssets.map((asset) => (
                        <option key={asset.hash} value={asset.hash}>
                            {asset.name}
                        </option>
                    ))}
                </select>
            )}
            <input
                className="input w-full font-mono text-xs"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
        </div>
    );
}

type SchemaUrlFieldProps = {
    value: string;
    disabled: boolean;
    onChange: (value?: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

const URL_PROTOCOL_SUGGESTIONS = ['https://', 'http://', 'mailto:', 'tel:'] as const;

export function SchemaUrlField({ value, disabled, onChange, onKeyDown }: SchemaUrlFieldProps) {
    return (
        <div className="space-y-1">
            <input
                className="input w-full"
                type="url"
                placeholder="https://example.com"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
            <div className="flex flex-wrap gap-1">
                {URL_PROTOCOL_SUGGESTIONS.map((proto) => (
                    <button
                        key={proto}
                        type="button"
                        className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                        onClick={() => onChange(proto)}
                        disabled={disabled}
                    >
                        {proto}
                    </button>
                ))}
                {value && (
                    <button
                        type="button"
                        className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
                        onClick={() => onChange(undefined)}
                        disabled={disabled}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}

type SchemaNumberFieldProps = {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled: boolean;
    onChange: (value: number | undefined) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function SchemaNumberField({ value, min, max, step, disabled, onChange, onKeyDown }: SchemaNumberFieldProps) {
    const stepValue = step ?? 1;
    const formattedStep = Number.isInteger(stepValue) ? stepValue.toFixed(0) : stepValue.toString();
    const handleChange = (raw: string) => {
        if (raw === '') { onChange(undefined); return; }
        const num = Number(raw);
        if (Number.isNaN(num)) { onChange(undefined); return; }
        onChange(num);
    };
    const adjust = (delta: number) => {
        const current = typeof value === 'number' ? value : (typeof min === 'number' ? min : 0);
        let next = current + delta;
        if (typeof min === 'number') next = Math.max(min, next);
        if (typeof max === 'number') next = Math.min(max, next);
        onChange(Number(next.toFixed(4)));
    };
    return (
        <div className="flex items-stretch gap-2">
            <input
                className="input w-full"
                type="number"
                value={value === undefined ? '' : value}
                min={min}
                max={max}
                step={stepValue}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
            <div className="flex flex-col gap-1">
                <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjust(stepValue)} disabled={disabled}>+{formattedStep}</button>
                <button className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold" type="button" onClick={() => adjust(-stepValue)} disabled={disabled}>-{formattedStep}</button>
            </div>
        </div>
    );
}
