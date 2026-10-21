/* Reusable board flows for the reviewer-bug scripts. */
import { login, waitPlanner, boardRect, dayX, minuteY, BASE } from './lib.mjs';

/**
 * The quiet week the seeded bookings live in (`node seed.mjs`): the Monday, env SEED_MONDAY. Cancelled bookings stay in the
 * database (nothing is deleted), so every fresh seed goes to a week of its own.
 */
export const SEED_MONDAY = process.env.SEED_MONDAY ?? '2027-01-11';
export const seedDay = (n) => {
  const d = new Date(SEED_MONDAY + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** "11. 1." for the day buttons of the phone / tablet strip. */
export const dayLabel = (iso) => `${Number(iso.slice(8, 10))}\\. ${Number(iso.slice(5, 7))}\\.`;
/** How many weeks ahead of the current week the seeded Monday is. */
export const weeksToSeed = () => {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Math.round((Date.parse(SEED_MONDAY + 'T12:00:00Z') - monday.getTime()) / (7 * 86400000));
};

export const ACCENTS = { forest: '#0D5C52', slate: '#2B3440', teal: '#0D9488', blue: '#2563EB', purple: '#7C3AED', orange: '#EA580C' };

/** Set the desk's theme (mode + accent) before the app boots: it reads both from localStorage. */
export async function setTheme(page, mode = 'dark', accent = 'forest') {
  const hex = ACCENTS[accent] ?? accent;
  await page.addInitScript(([m, a]) => { try { localStorage.setItem('sm-theme-mode-v2', m); localStorage.setItem('sm-theme-accent', a); } catch { /* */ } }, [mode, hex]);
}

export async function openPlanner(page, weeks = 4) {
  await login(page);
  await page.goto(BASE + '/planovani');
  await waitPlanner(page);
  for (let i = 0; i < weeks; i++) { await page.getByRole('button', { name: 'Následující týden' }).first().click(); await page.waitForTimeout(200); }
  await page.waitForTimeout(1200);
}

/** Click a free minute of one weekday column (0 = Monday); on phone / tablet take the day from the strip first. */
export async function clickBoard(page, size, dayIndex, minute, dayLabelRe) {
  const r = await boardRect(page);
  let x = dayX(r, dayIndex);
  if (size !== 'desktop') {
    await page.getByRole('button', { name: dayLabelRe }).first().click();
    await page.waitForTimeout(500);
    x = page.viewportSize().width * 0.6;
  }
  const y = minuteY(await boardRect(page), minute);
  if (y > page.viewportSize().height - 40) return false;
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  return true;
}

export const BUBBLE = '[aria-labelledby=new-appointment-title]';

/** Free minute -> "Objednat pacienta" -> event path -> step 2 with the first činnost chosen. */
export async function openBookingStep2(page, size, { minute = 540, dayIndex = 3, dayLabelRe = /19\. 11\./, activity = 'Základní sportovní' } = {}) {
  if (!(await clickBoard(page, size, dayIndex, minute, dayLabelRe))) return false;
  await page.getByText('Objednat pacienta', { exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByText('Jen zablokovat čas bez pacienta').first().click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.waitForTimeout(700);
  if (activity) { await page.locator(BUBBLE).getByText(activity).first().click(); await page.waitForTimeout(1200); }
  return true;
}
