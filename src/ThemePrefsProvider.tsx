import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material';
import { sanitizeAccent } from './accent';
import { buildTheme, type ThemeMode } from './theme';
import {
  ACCENT_STORAGE_KEY,
  MODE_STORAGE_KEY,
  ThemePrefsContext,
  readStoredAccent,
  readStoredMode,
} from './themePrefs';

/**
 * The person's look of the staff app: the accent and the light/dark mode, remembered in this browser.
 *
 *  - a choice applies at once (state -> a freshly built theme -> every MUI component, and AccentRootVars for the
 *    stylesheets) and is written to localStorage (`sm-theme-accent`, `sm-theme-mode-v2`); a browser that refuses
 *    storage (private mode) still gets the choice for this visit;
 *  - what is read back is validated (`readStoredAccent` / `readStoredMode`): junk is the default, never a broken palette;
 *  - another tab that changes the choice moves this one too (the `storage` event), so two open tabs never disagree.
 */
export function ThemePrefsProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(readStoredAccent);
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setAccent = useCallback((color: string) => {
    /* Only a usable colour is kept: a junk value would otherwise be stored and read back as the default next time anyway. */
    const next = sanitizeAccent(color);
    setAccentState(next);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, next); } catch { /* private mode */ }
  }, []);
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCENT_STORAGE_KEY || event.key === null) setAccentState(readStoredAccent());
      if (event.key === MODE_STORAGE_KEY || event.key === null) setModeState(readStoredMode());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const activeTheme = useMemo(() => buildTheme(accent, mode), [accent, mode]);
  const value = useMemo(() => ({ accent, mode, setAccent, setMode }), [accent, mode, setAccent, setMode]);
  return (
    <ThemePrefsContext.Provider value={value}>
      <ThemeProvider theme={activeTheme}>{children}</ThemeProvider>
    </ThemePrefsContext.Provider>
  );
}
