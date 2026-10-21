/*
 * 2.5 audit, part 3: where the popups sit. For the selection popover, the booking bubble, the hover card and the selected-card
 * bubble it measures (viewport px) whether the popup lies fully inside the screen and how far its nearest edge is from the
 * thing it belongs to. A popup that is cut off or further than FAR px from its anchor is reported.
 * Usage: node r25-pos.mjs [tag]
 */
import { launch, newPage, shot, boardRect, dayX, minuteY } from './lib.mjs';
import { setTheme, openPlanner, BUBBLE, weeksToSeed } from './flows.mjs';
const tag = process.argv[2] ?? 'audit';
const SIZES = [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]];
const FAR = 140; /* the anchor is the click point; a bubble sits beside the slot's whole column, so ~half a column + the gap is expected */
const dist = (a, p) => {
  const dx = Math.max(a.left - p.right, p.left - a.right, 0), dy = Math.max(a.top - p.bottom, p.top - a.bottom, 0);
  return Math.round(Math.hypot(dx, dy));
};
const b = await launch();
let bad = 0;
for (const [w, h] of SIZES) {
  const page = await newPage(b, { width: w, height: h, isMobile: false, hasTouch: false });
  await setTheme(page, 'dark', 'forest');
  await openPlanner(page, weeksToSeed());
  const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; }, sel);
  const check = (what, popup, anchor) => {
    if (!popup || !anchor) { console.log(`${w}x${h} ${what}: not found`); return; }
    const inside = popup.top >= 0 && popup.left >= 0 && popup.bottom <= h && popup.right <= w;
    const d = dist(anchor, popup);
    const flag = !inside || d > FAR;
    if (flag) bad++;
    console.log(`${w}x${h} ${what}: ${inside ? 'inside' : 'CUT OFF'}, ${d}px from its anchor ${flag ? '  <-- PROBLEM' : ''}`);
  };
  const r = await boardRect(page);
  for (const [name, minute, day] of [['early slot', 480, 4], ['late slot', 1000, 0]]) {
    const x = dayX(r, day), y = minuteY(r, minute);
    await page.mouse.click(x, y); await page.waitForTimeout(500);
    const anchor = { left: x - 2, right: x + 2, top: y - 2, bottom: y + 2 };
    check(`selection popover (${name})`, await rect('.MuiPopover-paper'), (await rect('.board-selection')) ?? anchor);
    await shot(page, `${tag}-2.5-pos-${w}x${h}-pop-${name.split(' ')[0]}`);
    await page.getByText('Objednat pacienta', { exact: true }).first().click(); await page.waitForTimeout(800);
    check(`booking bubble (${name})`, await rect(BUBBLE), (await rect('.board-selection')) ?? anchor);
    await shot(page, `${tag}-2.5-pos-${w}x${h}-bubble-${name.split(' ')[0]}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const discard = page.getByRole('button', { name: /Zahodit|Zavřít/ }); if (await discard.count()) await discard.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
  for (const idx of [0, 4]) {
    const card = page.locator('.schedule-event.board-booking').nth(idx);
    if (!(await card.count())) continue;
    await card.scrollIntoViewIfNeeded(); await card.hover(); await page.waitForTimeout(800);
    const cr = await card.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    check(`hover card (booking #${idx})`, await rect('.MuiTooltip-tooltip'), cr);
    await card.click(); await page.waitForTimeout(600);
    check(`selected-card summary (booking #${idx})`, await rect('[data-testid=board-summary], .board-summary, .MuiPopover-paper'), cr);
    await shot(page, `${tag}-2.5-pos-${w}x${h}-card${idx}`);
    await page.keyboard.press('Escape'); await page.mouse.move(5, 5); await page.waitForTimeout(300);
  }
  await page.close();
}
await b.close();
console.log(bad ? `${bad} problem(s)` : 'no problems');
