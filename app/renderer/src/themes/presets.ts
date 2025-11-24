import type { ThemePreset } from './types';

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'light-default',
    name: 'Modern Light',
    description: 'Bright surface with cyan primary accents.',
    colors: {
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
    },
    typography: {
      heading: 'Space Grotesk',
      body: 'Inter',
      scale: 1,
    },
  },
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    description: 'Dark canvas with electric cyan and magenta highlights.',
    colors: {
      background: '#05060a',
      surface: '#0f172a',
      primary: '#22d3ee',
      secondary: '#93c5fd',
      accent: '#f472b6',
      text: '#f8fafc',
      muted: '#94a3b8',
      border: '#1f2937',
      widgetBackground: '#0b1120',
      widgetText: '#e2e8f0',
    },
    typography: {
      heading: 'Clash Display',
      body: 'Inter',
      scale: 1.05,
    },
  },
  {
    id: 'noir-serif',
    name: 'Noir Serif',
    description: 'Editorial serif headings with matte charcoal background.',
    colors: {
      background: '#0b0d12',
      surface: '#111827',
      primary: '#fcd34d',
      secondary: '#f8fafc',
      accent: '#fb7185',
      text: '#f8fafc',
      muted: '#cbd5f5',
      border: '#1f2937',
      widgetBackground: '#111827',
      widgetText: '#f8fafc',
    },
    typography: {
      heading: 'Playfair Display',
      body: 'Source Sans Pro',
      scale: 1.08,
    },
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    description: 'Soft gradients with rounded acrylic surfaces.',
    colors: {
      background: '#fdf2f8',
      surface: '#fce7f3',
      primary: '#f472b6',
      secondary: '#38bdf8',
      accent: '#fb7185',
      text: '#4a044e',
      muted: '#9d174d',
      border: '#fbcfe8',
      widgetBackground: '#ffffff',
      widgetText: '#4a044e',
    },
    typography: {
      heading: 'Poppins',
      body: 'Poppins',
      scale: 0.98,
    },
  },
  {
    id: 'forest-tech',
    name: 'Forest Tech',
    description: 'Deep greens with amber accent and mono body text.',
    colors: {
      background: '#06140c',
      surface: '#0b1f13',
      primary: '#34d399',
      secondary: '#fcd34d',
      accent: '#f97316',
      text: '#d1fae5',
      muted: '#6ee7b7',
      border: '#065f46',
      widgetBackground: '#092715',
      widgetText: '#ecfdf5',
    },
    typography: {
      heading: 'Sora',
      body: 'IBM Plex Mono',
      scale: 1,
    },
  },
];

export const DEFAULT_THEME_PRESET_ID = 'light-default';

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id);
}
