import { useMemo, useState } from 'react';

import type { PropSchema, WidgetDefinition } from './types';

export type ValidationResult<P> = {
    ok: boolean;
    errors: string[];
    value: P;
};

function isTypeMatch(expected: string, value: unknown): boolean {
    if (expected === 'array') return Array.isArray(value);
    if (expected === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
    return typeof value === expected;
}

export function validateProps<P>(schema: PropSchema | undefined, props: unknown, defaults?: Partial<P>): ValidationResult<P> {
    const errors: string[] = [];
    const out: Record<string, unknown> = { ...(defaults as object) };
    const input = (props ?? {}) as Record<string, unknown>;
    if (!schema) {
        return { ok: true, errors, value: (props as P) ?? (defaults as P) };
    }
    for (const [key, spec] of Object.entries(schema)) {
        const provided = input[key];
        const hasProvided = Object.prototype.hasOwnProperty.call(input, key);
        if (!hasProvided || provided === undefined) {
            if (spec.required && spec.default === undefined) {
                errors.push(`Missing required prop: ${key}`);
            }
            if (spec.default !== undefined) out[key] = spec.default;
            continue;
        }
        if (!isTypeMatch(spec.type, provided)) {
            errors.push(`Invalid type for ${key}: expected ${spec.type}`);
            continue;
        }
        if (spec.validate) {
            const res = spec.validate(provided);
            if (res !== true) {
                errors.push(typeof res === 'string' ? res : `Validation failed for ${key}`);
                continue;
            }
        }
        out[key] = provided;
    }
    // pass-through unknown keys
    for (const [k, v] of Object.entries(input)) {
        if (!(k in (schema as object))) out[k] = v;
    }
    const ok = errors.length === 0;
    return { ok, errors, value: out as P };
}

export function useWidgetConfig<P>(def: WidgetDefinition<P>, incoming?: Partial<P>) {
    const initial: P = useMemo(() => {
        const merged = { ...(def.defaultProps as object), ...(incoming as object) } as P;
        if (def.schema) {
            const res = validateProps<P>(def.schema, merged, def.defaultProps);
            return res.value;
        }
        return merged;
    }, [def, incoming]);

    const [config, setConfig] = useState<P>(initial);
    const [errors, setErrors] = useState<string[]>([]);

    function set(next: P) {
        if (def.schema) {
            const res = validateProps<P>(def.schema, next, def.defaultProps);
            setErrors(res.errors);
            setConfig(res.value);
        } else {
            setConfig(next);
            setErrors([]);
        }
    }

    function patch(partial: Partial<P>) {
        set({ ...(config as object), ...(partial as object) } as P);
    }

    function reset() {
        set(def.defaultProps);
    }

    return { config, set, patch, reset, errors } as const;
}
