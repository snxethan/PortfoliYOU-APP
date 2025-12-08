import { PREVIEW_IFRAME_GLOBAL_RESETS } from '../../../shared/staticStyles';

export type GlobalStyleSnapshot = {
    tailwindCss: string;
    resetsCss: string;
};

async function extractCssFromSheet(sheet: StyleSheet): Promise<string | null> {
    const cssSheet = sheet as CSSStyleSheet;
    try {
        const rules = cssSheet?.cssRules;
        if (!rules || rules.length === 0) return null;
        return Array.from(rules).map((rule) => rule.cssText).join('\n');
    } catch {
        const owner = sheet.ownerNode as (HTMLLinkElement | HTMLStyleElement | null);
        if (owner && owner instanceof HTMLLinkElement && owner.href) {
            try {
                const res = await fetch(owner.href, { cache: 'no-store' });
                if (res.ok) {
                    return await res.text();
                }
            } catch {
                return null;
            }
        }
        if (owner && owner instanceof HTMLStyleElement) {
            return owner.textContent || null;
        }
        return null;
    }
}

export async function captureGlobalStyleSnapshot(): Promise<GlobalStyleSnapshot> {
    if (typeof document === 'undefined') {
        return { tailwindCss: '', resetsCss: PREVIEW_IFRAME_GLOBAL_RESETS };
    }
    const seen = new Set<string>();
    const chunks: string[] = [];
    const push = (css: string | null | undefined) => {
        const trimmed = (css || '').trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        chunks.push(trimmed);
    };

    const sheets = Array.from(document.styleSheets || []);
    for (const sheet of sheets) {
        try {
            const css = await extractCssFromSheet(sheet);
            if (css) push(css);
        } catch {
            // ignore sheet errors and continue
        }
    }

    if (chunks.length === 0) {
        document.querySelectorAll('style').forEach((styleEl) => push(styleEl.textContent));
    }

    return {
        tailwindCss: chunks.join('\n\n'),
        resetsCss: PREVIEW_IFRAME_GLOBAL_RESETS,
    };
}
