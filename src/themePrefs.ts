import { createContext, useContext } from 'react';
import type { ThemeMode } from './theme';

/** The doctor's own appearance choice, remembered in this browser. */
export interface ThemePrefs {
  accent: string;
  mode: ThemeMode;
  setAccent: (color: string) => void;
  setMode: (mode: ThemeMode) => void;
}

export const ACCENT_STORAGE_KEY = 'sm-theme-accent';
export const MODE_STORAGE_KEY = 'sm-theme-mode';
/* The board's forest green (THEME_ACCENTS[0]); the old teal still works for
   anybody who picked it, it just is not the default any more. */
export const DEFAULT_ACCENT = '#0D5C52';

export const ThemePrefsContext = createContext<ThemePrefs | null>(null);

export function useThemePrefs(): ThemePrefs {
  const ctx = useContext(ThemePrefsContext);
  if (!ctx) {
    throw new Error('useThemePrefs must be used within ThemePrefsContext');
  }
  return ctx;
}

export function readStoredAccent(): string {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function readStoredMode(): ThemeMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
