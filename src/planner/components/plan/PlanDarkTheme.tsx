/*
 * The planner is one dark stage (the file's palette). The bubbles that club planning reuses from the calendar
 * (`PickActivityPopover`, `PickShortfallDialog`) are MUI popovers drawn in a portal, i.e. in whatever theme the
 * page is in; this puts them in the application's own dark theme (`buildTheme(…, 'dark')`, which carries the
 * file's surfaces and the cyan family), so they look like the rest of the planner whatever theme the desk chose.
 * The cyan family follows the desk's accent (Nastavení -> Osobní -> Vzhled) exactly as the stage's own CSS does.
 */
import { ThemeProvider } from '@mui/material/styles';
import { useContext, useMemo, type ReactNode } from 'react';
import { buildTheme } from '../../../theme';
import { DEFAULT_ACCENT, ThemePrefsContext } from '../../../themePrefs';

export function PlanDarkTheme({ children }: { children: ReactNode }) {
  /* Outside the application's provider (a lab, a test) the default accent is used instead of throwing. */
  const accent = useContext(ThemePrefsContext)?.accent ?? DEFAULT_ACCENT;
  const theme = useMemo(() => buildTheme(accent, 'dark'), [accent]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
