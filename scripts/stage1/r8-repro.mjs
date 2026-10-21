/*
 * R8: a činnost whose price-list link is missing says "bez ceny" in the planner although the price list has it.
 * Temporarily unlinks "Základní sportovní prohlídka" on the dev stack (restored in `finally`), then reads the main
 * planner's filter list, the club planner's deck and the finish summary for "bez ceny".
 * Usage: node scripts/stage1/r8-repro.mjs [label]   (label names the screenshots)
 */
import { launch, newPage, login, api, shot, BASE, waitPlanner, startClubOrder } from './lib.mjs';
const label = process.argv[2] ?? 'before';
const NAME = 'Základní sportovní prohlídka';
const browser = await launch();
const page = await newPage(browser, 'desktop');
await login(page);
const unwrap = (r) => (r.json && r.json.data !== undefined ? r.json.data : r.json);
const list = async () => unwrap(await api(page, 'GET', '/api/activities')).activities;
const original = (await list()).find((a) => a.name === NAME);
const body = (a, link) => ({
  name: a.name, durationMinutes: a.durationMinutes, color: a.color, publicNote: a.publicNote, isPubliclyBookable: a.isPubliclyBookable,
  requiresReportByEmail: a.requiresReportByEmail, requiresClubSharing: a.requiresClubSharing, questionnaireRequirement: a.questionnaireRequirement,
  sortOrder: a.sortOrder, serviceItemId: link, clinicServiceId: a.clinicServiceId, questionnaireDefinitionId: a.questionnaireDefinitionId,
  colorHex: a.colorHex, parallelCapacity: a.parallelCapacity, requiredDocumentTemplateIds: a.requiredDocumentTemplateIds,
});
try {
  const r = await api(page, 'PUT', `/api/activities/${original.id}`, body(original, null));
  console.log('unlink status', r.status, '-> priceCzk now', (await list()).find((a) => a.id === original.id).priceCzk);
  // main planner: the filter list
  await page.goto(`${BASE}/planovani`);
  await waitPlanner(page);
  const options = await page.$$eval('#activity-filter option', (o) => o.map((x) => x.textContent));
  console.log('main planner filter:', options.filter((o) => /prohl/i.test(o)).join(' || '));
  await shot(page, `r8-${label}-main`);
  // club planner: the deck and the finish summary
  const club = (await api(page, 'GET', '/api/clubs')).json.find((c) => c.name === 'ZZ test plánování');
  await startClubOrder(page, club.id, { [NAME]: 3 });
  const deck = (await page.locator('[data-testid=planning-carousel], .s42-summary-card, #order-command').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
  console.log('club planner mentions "bez ceny":', /bez ceny/.test(await page.locator('body').innerText()));
  console.log('deck text:', deck.slice(0, 300));
  await shot(page, `r8-${label}-club`);
  const sum = page.locator('button:has-text("Připravit formulář"):visible, [data-s41-action=summary]:visible').first();
  const body_ = await page.locator('body').innerText();
  console.log('lines with cena:', body_.split('\n').filter((l) => /cen|Kč|bez ceny/i.test(l)).slice(0, 15).join(' || '));
} finally {
  const r = await api(page, 'PUT', `/api/activities/${original.id}`, body(original, original.serviceItemId));
  console.log('restore status', r.status, '-> priceCzk', (await list()).find((a) => a.id === original.id).priceCzk);
  await browser.close();
}
