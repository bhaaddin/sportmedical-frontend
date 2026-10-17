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
/*
 * The staff app's look is the dark glass of the planner prototype (owner, 18. 10. 2026: "this is how it must
 * look", not an option that appears in dark mode only). The choice used to default to light and was stored
 * under `sm-theme-mode`; every browser that ever opened the app holds a stored "light" (or nothing), which
 * must not keep anybody on the old look. So the choice lives under a NEW, versioned key: a browser that has
 * not chosen since this version starts dark (the legacy key is never read again and is cleaned up), and
 * whoever picks "Světlý režim" afterwards keeps it (the light palette stays in `buildTheme`). There is no
 * server-side account preference to migrate - the mode only ever lived in localStorage.
 * The public site and the club/patient portals draw their own themes and are not affected.
 */
export const MODE_STORAGE_KEY = 'sm-theme-mode-v2';
export const LEGACY_MODE_STORAGE_KEY = 'sm-theme-mode';
export const DEFAULT_MODE: ThemeMode = 'dark';
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

/** The saved choice: an explicit v2 "light" wins, everything else (nothing saved, a pre-v2 value, junk) is the dark default. */
export function readStoredMode(): ThemeMode {
  try {
    /* One-time migration: the pre-v2 key said "light" for everybody who never touched it; drop it. */
    if (localStorage.getItem(LEGACY_MODE_STORAGE_KEY) !== null) localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}
