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

/** The attribute the light look of the planner's stylesheets hangs on (`html[data-sm-mode="light"]`, src/planner/styles/planner.light.css). */
export const MODE_ATTRIBUTE = 'data-sm-mode';

let lightLayer: Promise<unknown> | null = null;
/** The planner's light stylesheets, fetched only when somebody is in light mode (dark never downloads them). */
function loadLightLayer(): void {
  /* one after the other: the hand-written fixes must land after the generated layer they correct */
  lightLayer ??= import('./planner/styles/planner.light.css')
    .then(() => import('./planner/styles/planner.light.extra.css'))
    .catch(() => {
      lightLayer = null;
    });
}

/**
 * Puts the picked accent on the document root as custom properties (`accentVariables`) so the stylesheets that
 * cannot read the MUI theme - the planner's CSS, theme.css - follow it, and the mode as `data-sm-mode` so the planner's
 * light stylesheet applies. Mounted ONLY inside the signed-in staff app: the patient portals and the club/booking pages
 * draw their own themes and must never see an accent, so leaving the staff app (or unmounting) removes every property
 * again. The default accent sets nothing but the mode - the stylesheets' own fallbacks are then the default look.
 */
export function AccentRootVars() {
  const { accent, mode, plannerTint: own = null, clinicPlannerTint = null } = useThemePrefs();
  /* This browser's own tint first, then the clinic's, then the accent (`accentVariables` falls back to it on null). */
  const plannerTint = own ?? clinicPlannerTint;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(accent, mode, plannerTint);
    applyVariables(root, vars);
    root.setAttribute(MODE_ATTRIBUTE, mode);
    if (mode === 'light') loadLightLayer();
    return () => {
      applyVariables(root, Object.fromEntries(Object.keys(vars).map((k) => [k, null])));
      root.removeAttribute(MODE_ATTRIBUTE);
    };
  }, [accent, mode, plannerTint]);
  return null;
}
