const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function hasScheme(value: string): boolean {
    return HAS_SCHEME.test(value);
}

/**
 * Normalize a user-supplied URL so that only http(s) schemes are allowed.
 * Falls back to prefixing https:// when the user omits a protocol.
 */
export function normalizeExternalLinkUrl(input?: string): string {
    const raw = (input ?? '').trim();
    if (!raw) return '';
    const attempts: string[] = hasScheme(raw) ? [raw] : [`https://${raw}`];
    for (const candidate of attempts) {
        try {
            const parsed = new URL(candidate);
            if (!HTTP_PROTOCOLS.has(parsed.protocol)) continue;
            return parsed.toString();
        } catch {
            continue;
        }
    }
    return '';
}

/**
 * Quick scheme check without trying to coerce the URL.
 */
export function hasSupportedHttpScheme(input?: string): boolean {
    if (!input) return false;
    try {
        const parsed = new URL(input.trim());
        return HTTP_PROTOCOLS.has(parsed.protocol);
    } catch {
        return false;
    }
}

export const ALLOWED_HTTP_SCHEME_LABEL = 'http:// or https://';
