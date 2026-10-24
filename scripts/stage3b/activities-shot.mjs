import { launch, newPage, login, setTheme, jpg, waitPlanner, BASE } from './lib.mjs';
const b = await launch();
for (const mode of ['dark', 'light']) {
  const p = await newPage(b); await login(p); await setTheme(p, mode);
  await p.goto(BASE + '/planovani'); await waitPlanner(p);
  await p.locator('[data-testid=mini-day-2026-10-27]').first().click(); await p.waitForTimeout(1800);
  const cols = await p.evaluate(() => [...new Set([...document.querySelectorAll('#grid-events .schedule-event')].map((e) => (e.getAttribute('style') || '').match(/--ev-border:\s*(#[0-9a-fA-F]{6})/)?.[1]))]);
  console.log(mode, 'distinct card colours on the board:', cols.join(' '));
  await jpg(p, `activities-${mode}`, 50);
  await p.context().close();
}
await b.close();
