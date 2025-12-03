import type { Theme } from '../themes/types';
import { FALLBACK_WIDGET_THEME, type WidgetThemeSnapshot } from '../../../shared/staticStyles';
export { FALLBACK_WIDGET_THEME, themeSnapshotToCss } from '../../../shared/staticStyles';
export type { WidgetThemeSnapshot } from '../../../shared/staticStyles';

function readComputedVar(styles: CSSStyleDeclaration | null, name: string, fallback: string) {
    if (!styles) return fallback;
    const raw = styles.getPropertyValue(name);
    if (!raw) return fallback;
    const trimmed = raw.trim();
    return trimmed || fallback;
}

export function getWidgetThemeSnapshot(theme?: Theme | null): WidgetThemeSnapshot {
    if (typeof document === 'undefined') return FALLBACK_WIDGET_THEME;
    const targetDoc = document;
    const styles = targetDoc.defaultView ? targetDoc.defaultView.getComputedStyle(targetDoc.documentElement) : null;
    const fontScaleValue = parseFloat(readComputedVar(styles, '--font-scale', `${theme?.typography.scale ?? FALLBACK_WIDGET_THEME.fontScale}`));
    return {
        text: readComputedVar(styles, '--widget-fg', readComputedVar(styles, '--fg', theme?.colors.text ?? FALLBACK_WIDGET_THEME.text)),
        muted: readComputedVar(styles, '--fg-muted', theme?.colors.muted ?? FALLBACK_WIDGET_THEME.muted),
        accent: readComputedVar(styles, '--accent', theme?.colors.accent ?? FALLBACK_WIDGET_THEME.accent),
        primary: readComputedVar(styles, '--primary', theme?.colors.primary ?? FALLBACK_WIDGET_THEME.primary),
        secondary: readComputedVar(styles, '--secondary', theme?.colors.secondary ?? FALLBACK_WIDGET_THEME.secondary),
        border: readComputedVar(styles, '--border', theme?.colors.border ?? FALLBACK_WIDGET_THEME.border),
        background: readComputedVar(styles, '--bg', theme?.colors.background ?? FALLBACK_WIDGET_THEME.background),
        surface: readComputedVar(styles, '--surface', theme?.colors.surface ?? FALLBACK_WIDGET_THEME.surface),
        widgetBackground: readComputedVar(styles, '--widget-bg', theme?.colors.widgetBackground ?? theme?.colors.surface ?? FALLBACK_WIDGET_THEME.widgetBackground),
        widgetText: readComputedVar(styles, '--widget-fg', theme?.colors.widgetText ?? theme?.colors.text ?? FALLBACK_WIDGET_THEME.widgetText),
        headingFont: readComputedVar(styles, '--heading-font', theme?.typography.heading ?? FALLBACK_WIDGET_THEME.headingFont),
        bodyFont: readComputedVar(styles, '--body-font', theme?.typography.body ?? FALLBACK_WIDGET_THEME.bodyFont),
        fontScale: Number.isFinite(fontScaleValue) ? Number(fontScaleValue.toFixed(2)) : FALLBACK_WIDGET_THEME.fontScale,
    };
}
