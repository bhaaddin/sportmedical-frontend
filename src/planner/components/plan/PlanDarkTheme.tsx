/*
 * The bubbles that club planning reuses from the calendar (`PickActivityPopover`, `PickShortfallDialog`) are MUI popovers
 * drawn in a portal, i.e. in whatever theme the page is in. They used to be forced into the dark theme because the planner
 * stage was dark in either mode; since R15e the stage follows the Světlý/Tmavý switch, so these follow it too
 * (`buildTheme(accent, mode)`) and look like the rest of the planner in both modes.
 * The accent is the desk's (Nastavení -> Osobní -> Vzhled). Outside the application's provider (a lab, a test) the default
 * accent and the dark mode are used instead of throwing.
 * (The file keeps its name; the component is the planner's theme, not only its dark one.)
 */
import { ThemeProvider } from '@mui/material/styles';
import { useContext, useMemo, type ReactNode } from 'react';
import { buildTheme } from '../../../theme';
import { DEFAULT_ACCENT, DEFAULT_MODE, ThemePrefsContext } from '../../../themePrefs';

export function PlanDarkTheme({ children }: { children: ReactNode }) {
  const prefs = useContext(ThemePrefsContext);
  const accent = prefs?.accent ?? DEFAULT_ACCENT;
  const mode = prefs?.mode ?? DEFAULT_MODE;
  const theme = useMemo(() => buildTheme(accent, mode), [accent, mode]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
