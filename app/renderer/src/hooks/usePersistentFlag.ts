import { useCallback, useState } from 'react';

/**
 * Persistent boolean state backed by localStorage. Accepts direct boolean values
 * or updater functions, mirroring React's setState API, and gracefully
 * defaults when storage is unavailable.
 */
export function usePersistentFlag(key: string, defaultValue = false) {
    const [value, setValue] = useState<boolean>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const stored = window.localStorage.getItem(key);
            if (stored === null) return defaultValue;
            return stored === '1' || stored === 'true';
        } catch {
            return defaultValue;
        }
    });

    const update = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
        setValue((prev) => {
            const resolved = typeof next === 'function' ? (next as (prevValue: boolean) => boolean)(prev) : next;
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(key, resolved ? '1' : '0');
                } catch {
                    /* ignore */
                }
            }
            return resolved;
        });
    }, [key]);

    return [value, update] as const;
}
