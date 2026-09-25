/* ══════════════════════════════════════════════════════════════
   THE FOUR THEMES

   One static light theme used to be the only look, and a "dark mode"
   switch that changed nothing was removed as fake. These are real: each is
   a full MUI palette, chosen per account in Můj účet and stored on the
   server (`PUT /api/v1/account/preferences { theme }`), so it follows the
   person to the next browser.

   Eye-safe by rule, not by taste: no palette uses pure black (#000000) or
   pure white (#FFFFFF) anywhere, and every body text sits on its background
   at WCAG AA contrast or better. `theme.test.ts` measures both.

   The keys are the server's catalogue (`AccountPreferenceRules.Themes`). A
   key here without a palette there - or the other way round - is a choice
   that changes nothing, which is the thing this file replaces.
   ══════════════════════════════════════════════════════════════ */
import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

export const THEME_KEYS = ['clinic-light', 'calm-warm', 'contrast-dark', 'print-mono'] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export const DEFAULT_THEME: ThemeKey = 'clinic-light';

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

/**
 * The colours each theme is built from. Kept as plain values, separate from
 * `createTheme`, so the contrast test can read them without MUI in the way.
 */
export interface ThemeColors {
  mode: 'light' | 'dark';
  primary: { main: string; light: string; dark: string; contrastText: string };
  secondary: { main: string; light: string; dark: string; contrastText: string };
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  success: string;
  warning: string;
  error: string;
  info: string;
  divider: string;
  /** Applied to `AppBar`; never pure black or white. */
  appBar: { background: string; text: string };
}

export const THEME_COLORS: Record<ThemeKey, ThemeColors> = {
  /* What the clinic has always seen - teal on a cool grey - with the pure
     white paper replaced by an off-white the eye does not have to fight. */
  'clinic-light': {
    mode: 'light',
    primary: { main: '#0D7377', light: '#14A3A8', dark: '#095456', contrastText: '#F7FBFB' },
    secondary: { main: '#1A1A2E', light: '#16213E', dark: '#0F0F1A', contrastText: '#F2F3F7' },
    background: { default: '#F0F4F8', paper: '#FBFCFD' },
    text: { primary: '#1B2430', secondary: '#4E5A68', disabled: '#8A94A0' },
    success: '#2E7D32',
    warning: '#C25A00',
    error: '#C62828',
    info: '#0277BD',
    divider: '#D9E0E8',
    appBar: { background: '#0D7377', text: '#F7FBFB' },
  },
  /* Warm paper and brown-green controls: less blue light, less glare, for a
     screen that stays on all day. */
  'calm-warm': {
    mode: 'light',
    primary: { main: '#8A5A2B', light: '#B07E4E', dark: '#5F3D1B', contrastText: '#FBF6EF' },
    secondary: { main: '#4F6D5A', light: '#76907F', dark: '#354B3D', contrastText: '#F3F6F3' },
    background: { default: '#F5F0E8', paper: '#FCF9F3' },
    text: { primary: '#2E2A24', secondary: '#5C554B', disabled: '#948C80' },
    success: '#4F7A3A',
    warning: '#A85A00',
    error: '#B03A2E',
    info: '#4A6E8A',
    divider: '#E2D9CB',
    appBar: { background: '#6E4823', text: '#FBF6EF' },
  },
  /* Light text on charcoal - never pure black, never pure white - for a
     dimmed room or a tired pair of eyes. */
  'contrast-dark': {
    mode: 'dark',
    primary: { main: '#5FD3D8', light: '#8FE3E7', dark: '#2BA6AC', contrastText: '#0F1A1B' },
    secondary: { main: '#F2C46D', light: '#F7D896', dark: '#C89A3E', contrastText: '#1A1608' },
    background: { default: '#12161C', paper: '#1B2129' },
    text: { primary: '#E6EAF0', secondary: '#AEB7C4', disabled: '#7B8593' },
    success: '#7BD88F',
    warning: '#F5B04A',
    error: '#F08A80',
    info: '#7CC4F5',
    divider: '#2E3742',
    appBar: { background: '#0E1216', text: '#E6EAF0' },
  },
  /* Greys only, with strong outlines: what a black-and-white printer would
     make of the screen, so what is on paper is what was on screen. Status is
     always written in words anyway (7.1), so nothing is lost with the colour. */
  'print-mono': {
    mode: 'light',
    primary: { main: '#2B2B2B', light: '#555555', dark: '#151515', contrastText: '#F5F5F5' },
    secondary: { main: '#4A4A4A', light: '#6E6E6E', dark: '#2E2E2E', contrastText: '#F5F5F5' },
    background: { default: '#F2F2F2', paper: '#FAFAFA' },
    text: { primary: '#1A1A1A', secondary: '#4A4A4A', disabled: '#8C8C8C' },
    success: '#3A3A3A',
    warning: '#5A5A5A',
    error: '#2A2A2A',
    info: '#4A4A4A',
    divider: '#8C8C8C',
    appBar: { background: '#2B2B2B', text: '#F5F5F5' },
  },
};

/** The MUI theme for one key. Unknown keys get the default, never a crash. */
export function buildTheme(key: string | null | undefined): Theme {
  const colors = THEME_COLORS[isThemeKey(key) ? key : DEFAULT_THEME];
  const mono = key === 'print-mono';

  const options: ThemeOptions = {
    palette: {
      mode: colors.mode,
      primary: colors.primary,
      secondary: colors.secondary,
      background: colors.background,
      text: colors.text,
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      info: { main: colors.info },
      divider: colors.divider,
    },
    shape: { borderRadius: mono ? 4 : 12 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: colors.appBar.background,
            color: colors.appBar.text,
            boxShadow: mono ? 'none' : `0 2px 16px ${colors.appBar.background}40`,
            borderBottom: mono ? `2px solid ${colors.divider}` : undefined,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: mono ? 4 : 8, textTransform: 'none', fontWeight: 600 },
          contained: { boxShadow: mono ? 'none' : `0 2px 8px ${colors.primary.main}4D` },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: mono ? 4 : 16,
            boxShadow: mono
              ? 'none'
              : colors.mode === 'dark'
                ? '0 2px 12px rgba(0,0,0,0.45)'
                : '0 2px 12px rgba(0,0,0,0.08)',
            border: mono ? `1px solid ${colors.divider}` : undefined,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: mono ? 4 : 12, backgroundImage: 'none' },
        },
      },
    },
  };

  return createTheme(options);
}

/** The look everybody gets until their own choice is known. */
const theme = buildTheme(DEFAULT_THEME);

export default theme;
