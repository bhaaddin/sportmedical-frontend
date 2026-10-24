/* Shared helpers of the stage-3b checks: club-planning's own-Chromium helpers pointed at this worktree's Vite (:3010). */
import './env.mjs';
export * from '../club-planning/lib.mjs';
import { login as baseLogin, api } from '../club-planning/lib.mjs';
export { api };

/** Signs in once, then sets the theme choice (mode + accent) in localStorage before the app boots. */
export async function setTheme(page, mode, accentHex) {
  await page.evaluate(({ mode, accentHex }) => {
    localStorage.setItem('sm-theme-mode-v2', mode);
    if (accentHex) localStorage.setItem('sm-theme-accent', accentHex);
  }, { mode, accentHex });
}
export const ACCENTS = [
  ['forest', '#0D5C52'], ['slate', '#2B3440'], ['teal', '#0D9488'], ['blue', '#2563EB'], ['purple', '#7C3AED'], ['orange', '#EA580C'],
];
export async function jpg(page, name, quality = 55) {
  await page.screenshot({ path: `${process.env.OUT ?? 'design/stage3b'}/${name}.jpg`, type: 'jpeg', quality });
}
export { baseLogin as login };
