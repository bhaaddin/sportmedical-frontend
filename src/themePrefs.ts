import { createContext, useContext } from 'react';
import type { ThemeMode } from './theme';
import { sanitizeAccent } from './accent';

/** The doctor's own appearance choice, remembered in this browser. */
export interface ThemePrefs {
  accent: string;
  mode: ThemeMode;
  setAccent: (color: string) => void;
  setMode: (mode: ThemeMode) => void;
  /**
   * R15d: the planner's own tint (Nastavení -> Barvy). `null` = the planner follows the accent (the default). Remembered in this
   * browser like the accent itself: the clinic-wide copy needs one backend field (docs/stage3b-2026-10.md). Optional so a test
   * context need not name it.
   */
  plannerTint?: string | null;
  setPlannerTint?: (color: string | null) => void;
  /**
   * The clinic's planner tint (`calendar-display.plannerTintColor`, a server that has the field), fed by `ClinicPlannerTint`.
   * The planner uses this browser's own tint first, then the clinic's, then the accent.
   */
  clinicPlannerTint?: string | null;
  setClinicPlannerTint?: (color: string | null) => void;
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
export const PLANNER_TINT_STORAGE_KEY = 'sm-planner-tint';
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

/** The saved accent: a plain hex colour that works as a button on the light page, else (nothing saved, junk) the default. */
export function readStoredAccent(): string {
  try {
    return sanitizeAccent(localStorage.getItem(ACCENT_STORAGE_KEY));
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

/** The saved planner tint: a colour that works as a button on the light page, else (nothing saved, junk) `null` = follow the accent. */
export function readStoredPlannerTint(): string | null {
  try {
    const raw = localStorage.getItem(PLANNER_TINT_STORAGE_KEY);
    if (raw === null) return null;
    const clean = sanitizeAccent(raw);
    return clean === DEFAULT_ACCENT && raw.trim().toUpperCase() !== DEFAULT_ACCENT ? null : clean;
  } catch {
    return null;
  }
}
