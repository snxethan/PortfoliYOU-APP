import type { Theme } from '../themes/types';

export type WidgetThemeSnapshot = {
    text: string;
    muted: string;
    accent: string;
    primary: string;
    secondary: string;
    border: string;
    background: string;
    surface: string;
    widgetBackground: string;
    widgetText: string;
    headingFont: string;
    bodyFont: string;
    fontScale: number;
};

const FALLBACK_THEME: WidgetThemeSnapshot = {
    text: '#0f172a',
    muted: '#475569',
    accent: '#f97316',
    primary: '#0ea5e9',
    secondary: '#0f172a',
    border: '#e2e8f0',
    background: '#ffffff',
    surface: '#f7f9fc',
    widgetBackground: '#ffffff',
    widgetText: '#0f172a',
    headingFont: 'Space Grotesk, Inter, Segoe UI, system-ui, sans-serif',
    bodyFont: 'Inter, Segoe UI, system-ui, sans-serif',
    fontScale: 1,
};

function readComputedVar(styles: CSSStyleDeclaration | null, name: string, fallback: string) {
    if (!styles) return fallback;
    const raw = styles.getPropertyValue(name);
    if (!raw) return fallback;
    const trimmed = raw.trim();
    return trimmed || fallback;
}

export function getWidgetThemeSnapshot(theme?: Theme | null): WidgetThemeSnapshot {
    if (typeof document === 'undefined') return FALLBACK_THEME;
    const targetDoc = document;
    const styles = targetDoc.defaultView ? targetDoc.defaultView.getComputedStyle(targetDoc.documentElement) : null;
    const fontScaleValue = parseFloat(readComputedVar(styles, '--font-scale', `${theme?.typography.scale ?? FALLBACK_THEME.fontScale}`));
    return {
        text: readComputedVar(styles, '--widget-fg', readComputedVar(styles, '--fg', theme?.colors.text ?? FALLBACK_THEME.text)),
        muted: readComputedVar(styles, '--fg-muted', theme?.colors.muted ?? FALLBACK_THEME.muted),
        accent: readComputedVar(styles, '--accent', theme?.colors.accent ?? FALLBACK_THEME.accent),
        primary: readComputedVar(styles, '--primary', theme?.colors.primary ?? FALLBACK_THEME.primary),
        secondary: readComputedVar(styles, '--secondary', theme?.colors.secondary ?? FALLBACK_THEME.secondary),
        border: readComputedVar(styles, '--border', theme?.colors.border ?? FALLBACK_THEME.border),
        background: readComputedVar(styles, '--bg', theme?.colors.background ?? FALLBACK_THEME.background),
        surface: readComputedVar(styles, '--surface', theme?.colors.surface ?? FALLBACK_THEME.surface),
        widgetBackground: readComputedVar(styles, '--widget-bg', theme?.colors.widgetBackground ?? theme?.colors.surface ?? FALLBACK_THEME.widgetBackground),
        widgetText: readComputedVar(styles, '--widget-fg', theme?.colors.widgetText ?? theme?.colors.text ?? FALLBACK_THEME.widgetText),
        headingFont: readComputedVar(styles, '--heading-font', theme?.typography.heading ?? FALLBACK_THEME.headingFont),
        bodyFont: readComputedVar(styles, '--body-font', theme?.typography.body ?? FALLBACK_THEME.bodyFont),
        fontScale: Number.isFinite(fontScaleValue) ? Number(fontScaleValue.toFixed(2)) : FALLBACK_THEME.fontScale,
    };
}

export { FALLBACK_THEME as FALLBACK_WIDGET_THEME };
