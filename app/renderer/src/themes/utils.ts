import type { CSSProperties } from 'react';

import type { Theme, ThemeColors, ThemePatch, ThemePreset, ThemeTypography } from './types';

const FALLBACK_COLORS: ThemeColors = {
  background: '#ffffff',
  surface: '#f7f9fc',
  primary: '#0ea5e9',
  secondary: '#0f172a',
  accent: '#f97316',
  text: '#0f172a',
  muted: '#475569',
  border: '#e2e8f0',
  widgetBackground: '#ffffff',
  widgetText: '#0f172a',
};

const FALLBACK_TYPOGRAPHY: ThemeTypography = {
  heading: 'Inter',
  body: 'Inter',
  scale: 1,
};

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

export function normalizeColors(input?: Partial<ThemeColors>): ThemeColors {
  return {
    background: input?.background || FALLBACK_COLORS.background,
    surface: input?.surface || FALLBACK_COLORS.surface,
    primary: input?.primary || FALLBACK_COLORS.primary,
    secondary: input?.secondary || FALLBACK_COLORS.secondary,
    accent: input?.accent || FALLBACK_COLORS.accent,
    text: input?.text || FALLBACK_COLORS.text,
    muted: input?.muted || FALLBACK_COLORS.muted,
    border: input?.border || FALLBACK_COLORS.border,
    widgetBackground: input?.widgetBackground || input?.surface || FALLBACK_COLORS.widgetBackground,
    widgetText: input?.widgetText || input?.text || FALLBACK_COLORS.widgetText,
  };
}

export function normalizeTypography(input?: Partial<ThemeTypography>): ThemeTypography {
  const scale = typeof input?.scale === 'number' && Number.isFinite(input.scale) ? input.scale : FALLBACK_TYPOGRAPHY.scale;
  const clamped = Math.min(1.5, Math.max(0.75, scale));
  return {
    heading: input?.heading || FALLBACK_TYPOGRAPHY.heading,
    body: input?.body || FALLBACK_TYPOGRAPHY.body,
    scale: Number(clamped.toFixed(2)),
  };
}

export function createThemeFromPreset(preset: ThemePreset, overrides?: Partial<Theme>): Theme {
  const now = new Date().toISOString();
  return {
    themeId: overrides?.themeId || `theme_${makeId()}`,
    name: overrides?.name || preset.name,
    colors: normalizeColors({ ...preset.colors, ...(overrides?.colors || {}) }),
    typography: normalizeTypography({ ...preset.typography, ...(overrides?.typography || {}) }),
    schemaVersion: overrides?.schemaVersion || 1,
    createdAt: overrides?.createdAt || now,
    updatedAt: now,
    origin: overrides?.origin || 'preset',
  } satisfies Theme;
}

export function mergeTheme(theme: Theme, patch: ThemePatch): Theme {
  return {
    ...theme,
    name: patch.name ?? theme.name,
    origin: patch.origin ?? theme.origin,
    colors: normalizeColors({ ...theme.colors, ...(patch.colors || {}) }),
    typography: normalizeTypography({ ...theme.typography, ...(patch.typography || {}) }),
    updatedAt: new Date().toISOString(),
  } satisfies Theme;
}

export function themeToCssVars(theme: Theme): Record<string, string> {
  return {
    '--bg': theme.colors.background,
    '--surface': theme.colors.surface,
    '--muted': theme.colors.surface,
    '--border': theme.colors.border,
    '--fg': theme.colors.text,
    '--fg-muted': theme.colors.muted,
    '--primary': theme.colors.primary,
    '--accent': theme.colors.accent,
    '--secondary': theme.colors.secondary,
    '--widget-bg': theme.colors.widgetBackground,
    '--widget-fg': theme.colors.widgetText,
    '--heading-font': theme.typography.heading,
    '--body-font': theme.typography.body,
    '--font-scale': String(theme.typography.scale),
  };
}

export function applyThemeToElement(el: HTMLElement | null, theme?: Theme) {
  if (!el || !theme) return;
  const vars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
  el.style.setProperty('color', theme.colors.text);
  el.style.setProperty('background-color', theme.colors.background);
}

export function buildThemeInlineStyle(theme?: Theme): (CSSProperties & Record<string, string>) | undefined {
  if (!theme) return undefined;
  const vars = themeToCssVars(theme);
  const style = {} as CSSProperties & Record<string, string>;
  for (const [key, value] of Object.entries(vars)) {
    style[key] = value;
  }
  style.color = theme.colors.text;
  style.backgroundColor = 'transparent';
  style.fontFamily = theme.typography.body;
  style.fontSize = `${theme.typography.scale * 100}%`;
  return style;
}

export const FALLBACK_THEME: Theme = {
  themeId: 'theme_fallback_default',
  name: 'Default',
  colors: FALLBACK_COLORS,
  typography: FALLBACK_TYPOGRAPHY,
  schemaVersion: 1,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
  origin: 'preset',
};
