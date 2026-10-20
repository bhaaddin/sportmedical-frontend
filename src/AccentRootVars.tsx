import { useLayoutEffect } from 'react';
import { accentVariables } from './accent';
import { useThemePrefs } from './themePrefs';

/** Sets (or removes, for a `null`) each custom property on an element. */
export function applyVariables(element: HTMLElement, vars: Record<string, string | null>): void {
  for (const [name, value] of Object.entries(vars)) {
    if (value === null) element.style.removeProperty(name);
    else element.style.setProperty(name, value);
  }
}

/**
 * Puts the picked accent on the document root as custom properties (`accentVariables`) so the stylesheets that
 * cannot read the MUI theme - the planner's CSS, theme.css - follow it. Mounted ONLY inside the signed-in staff
 * app: the patient portals and the club/booking pages draw their own themes and must never see an accent, so
 * leaving the staff app (or unmounting) removes every property again. The default accent sets nothing at all - the
 * stylesheets' own fallbacks are then the default look.
 */
export function AccentRootVars() {
  const { accent, mode } = useThemePrefs();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(accent, mode);
    applyVariables(root, vars);
    return () => applyVariables(root, Object.fromEntries(Object.keys(vars).map((k) => [k, null])));
  }, [accent, mode]);
  return null;
}
