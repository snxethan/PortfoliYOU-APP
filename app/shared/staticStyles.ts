// Shared helpers for exporting preview/global styles into static builds.

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

export const FALLBACK_WIDGET_THEME: WidgetThemeSnapshot = {
    text: '#0f172a',
    muted: '#475569',
    accent: '#06b6d4',
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

export const PREVIEW_IFRAME_GLOBAL_RESETS = `*,*::before,*::after{box-sizing:border-box;}\nhtml,body{height:100%;}\nbody{margin:0;padding:0;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}\nimg,svg,video,canvas,audio,iframe{display:block;max-width:100%;}\nbutton,input,select,textarea{font:inherit;}\n`;

function snapshotToCssVars(snapshot: WidgetThemeSnapshot): Record<string, string> {
    return {
        '--bg': snapshot.background,
        '--surface': snapshot.surface,
        '--muted': snapshot.surface,
        '--border': snapshot.border,
        '--fg': snapshot.text,
        '--fg-muted': snapshot.muted,
        '--accent': snapshot.accent,
        '--primary': snapshot.primary,
        '--secondary': snapshot.secondary,
        '--widget-bg': snapshot.widgetBackground,
        '--widget-fg': snapshot.widgetText,
        '--heading-font': snapshot.headingFont,
        '--body-font': snapshot.bodyFont,
        '--font-scale': String(snapshot.fontScale),
    };
}

export function themeSnapshotToCss(snapshot?: WidgetThemeSnapshot | null, opts?: { includeResets?: boolean }): string {
    const theme = snapshot || FALLBACK_WIDGET_THEME;
    const vars = snapshotToCssVars(theme);
    const root = Object.entries(vars)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');
    let css = `:root {\n${root}\n}\n`;
    css += 'body { color: var(--fg); background-color: var(--bg); font-family: var(--body-font); font-size: calc(16px * var(--font-scale)); }\n';
    css += 'a { color: var(--accent); }\n';
    if (opts?.includeResets !== false) {
        css += PREVIEW_IFRAME_GLOBAL_RESETS;
    }
    return css;
}
