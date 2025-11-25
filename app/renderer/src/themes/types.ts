export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  widgetBackground: string;
  widgetText: string;
};

export type ThemeTypography = {
  heading: string;
  body: string;
  scale: number;
};

export type ThemeOrigin = 'preset' | 'custom';

export type Theme = {
  themeId: string;
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  origin: ThemeOrigin;
};

export type ThemePreset = {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
};

export type ThemePatch = Partial<Pick<Theme, 'name' | 'origin'>> & {
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
};
