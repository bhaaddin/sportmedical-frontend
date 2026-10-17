/*
 * The planner is one dark stage (the file's palette). The bubbles that club planning reuses from the calendar
 * (`PickActivityPopover`, `PickShortfallDialog`) are MUI popovers drawn in a portal, i.e. in whatever theme the
 * page is in; this puts them in the application's own dark theme (`buildTheme(…, 'dark')`, which carries the
 * file's surfaces and cyan), so they look like the rest of the planner whatever theme the desk chose.
 */
import { ThemeProvider } from '@mui/material/styles';
import { useMemo, type ReactNode } from 'react';
import { buildTheme } from '../../../theme';

export function PlanDarkTheme({ children }: { children: ReactNode }) {
  const theme = useMemo(() => buildTheme('#0D9488', 'dark'), []);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
