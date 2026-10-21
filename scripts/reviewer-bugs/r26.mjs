/*
 * 2.6 - the colour of a činnost, set once in Nastavení and drawn the same everywhere. Opens Barvy služeb a činností, gives
 * "Komplexní sportovní prohlídka" a colour of its own (typed, with the live preview), then reads the colour back in every view of
 * the planner (board card, agenda chip, mini calendar ring, month tile, day list) and finally resets it. Needs the seeded week.
 * Usage: node r26.mjs [desktop|tablet|phone] [tag]   (BASE=http://localhost:3000 shows how the unchanged app draws it)
 */
import { launch, newPage, login, shot, waitPlanner, BASE, api } from './lib.mjs';
import { setTheme } from './flows.mjs';
const size = process.argv[2] ?? 'desktop';
const tag = process.argv[3] ?? 'after';
const NAME = 'Komplexní sportovní prohlídka';
const COLOR = '#E9C46A';
const b = await launch();
const page = await newPage(b, size);
await setTheme(page, 'dark', 'forest');
await login(page);
const out = (k, v) => console.log(`[${size}] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
const effective = async () => (await api(page, 'GET', '/api/activities')).json.data.activities.find((a) => a.name === NAME);
const before = await effective();
out('before: own / effective', [before.colorHex, before.effectiveColorHex]);

await page.goto(BASE + '/nastaveni/barvy-sluzeb');
await page.waitForSelector(`[aria-label="Změnit barvu činnosti ${NAME}"]`, { timeout: 60000 });
await shot(page, `${tag}-2.6-${size}-1-settings`);
await page.click(`[aria-label="Změnit barvu činnosti ${NAME}"]`);
await page.waitForSelector('[data-testid=activity-color-editor]').catch(() => {});
const editor = await page.getByTestId('activity-color-editor').count();
out('editor with palette + custom hex + preview', editor ? 'yes' : 'no (palette only)');
if (editor) {
  await page.getByTestId('color-hex-input').fill(COLOR);
  await page.waitForTimeout(300);
  out('live preview', await page.evaluate(() => ({ pill: getComputedStyle(document.querySelector('[data-testid=color-preview-pill]')).backgroundColor, contrast: document.querySelector('[data-testid=color-contrast]').innerText })));
  await shot(page, `${tag}-2.6-${size}-2-editor-preview`);
  await page.getByTestId('color-hex-input').fill('#001421');
  out('guard on a colour nobody could see', await page.evaluate(() => ({ error: document.querySelector('[data-testid=activity-color-editor] .Mui-error, [data-testid=activity-color-editor] p.Mui-error')?.textContent ?? null, applyDisabled: document.querySelector('[data-testid=color-apply]').disabled })));
  await page.getByTestId('color-hex-input').fill(COLOR);
  await page.getByTestId('color-apply').click();
  await page.waitForTimeout(1500);
}
const after = await effective();
out('saved: own / effective', [after.colorHex, after.effectiveColorHex]);

/* every view of the planner draws it */
await page.goto(BASE + '/planovani');
await waitPlanner(page);
for (let i = 0; i < 7; i++) { await page.getByRole('button', { name: 'Následující týden' }).first().click(); await page.waitForTimeout(200); }
await page.waitForTimeout(1500);
const want = (after.effectiveColorHex ?? COLOR).toLowerCase();
const seen = await page.evaluate((name) => {
  const hex = (s) => (s || '').trim().toLowerCase();
  const rgb2hex = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('') : hex(c); };
  const card = [...document.querySelectorAll('[data-booking-id]')].find((c) => (c.getAttribute('aria-label') || '').includes('Komplexní sportovní'));
  const chip = [...document.querySelectorAll('.agenda-chip')].find((c) => (c.getAttribute('aria-label') || '').includes('Komplexní sportovní'));
  const ring = [...document.querySelectorAll('[data-testid="mini-day-2026-12-10"] circle')].map((c) => c.getAttribute('stroke')).filter(Boolean);
  return { boardCard: rgb2hex(card ? card.style.getPropertyValue('--ev-border') : ''), agendaChip: rgb2hex(chip ? getComputedStyle(chip).getPropertyValue('--agenda-tone') : ''), miniRing: ring.map(rgb2hex) };
}, NAME);
out('colour wanted', want);
out('board card', seen.boardCard);
out('agenda chip', seen.agendaChip);
out('mini calendar ring (Thu 10. 12.)', seen.miniRing);
await shot(page, `${tag}-2.6-${size}-3-planner`);
if (size !== 'phone') {
  await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click(); await page.waitForTimeout(900);
  out('month tile dot', await page.evaluate(() => { const i = document.querySelector('.month-tile[data-day="2026-12-10"] .tile-activity'); return i ? getComputedStyle(i).getPropertyValue('--tile-tone') : null; }));
  await shot(page, `${tag}-2.6-${size}-4-month`);
}
/* reset to the default */
if (editor) {
  await page.goto(BASE + '/nastaveni/barvy-sluzeb');
  await page.waitForSelector(`[aria-label="Změnit barvu činnosti ${NAME}"]`, { timeout: 60000 });
  await page.click(`[aria-label="Změnit barvu činnosti ${NAME}"]`);
  await page.getByTestId('color-reset').click();
  await page.waitForTimeout(1500);
  const reset = await effective();
  out('reset: own / effective', [reset.colorHex, reset.effectiveColorHex]);
}
await b.close();
