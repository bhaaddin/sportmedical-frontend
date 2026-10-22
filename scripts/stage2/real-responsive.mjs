/*
 * Stage 2 at the three layouts (phone 390x844, tablet 820x1180, desktop 1440x900) against the Stage 2 backend copy (:5193 via Vite :3006):
 * the služba selector, a holiday week, a club-held week, the lunch pop-out and the settings cards - no document scroll, nothing wider than
 * the screen, the new controls at least 44 px on touch layouts, screenshots in design/stage2/.
 *
 *   node scripts/stage2/real-responsive.mjs
 */
process.env.BASE ??= 'http://localhost:3006';
process.env.DEV_LOGIN ??= 'C:/Users/Matko/vt-tmp/s2api-login.txt';
process.env.OUT ??= 'design/stage2';
const { launch, newPage, login, shot, waitPlanner, BASE } = await import('./lib.mjs');

let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failed += 1;
};
const browser = await launch();

for (const size of ['phone', 'tablet', 'desktop']) {
  const touch = size !== 'desktop';
  const page = await newPage(browser, size);
  await login(page);
  const overflow = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
  const noScroll = async (what) => {
    const o = await overflow();
    check(o.sw <= o.iw && o.sh <= o.ih + 1, `${size}: ${what} - the document does not scroll (${o.sw}x${o.sh} in ${o.iw}x${o.ih})`);
  };

  /* the holiday week (26. 10.) */
  await page.goto(`${BASE}/planovani`);
  await waitPlanner(page);
  await page.click('[data-command=nextWeek]');
  await page.waitForTimeout(2200);
  await shot(page, `s2-real-${size}-week-holiday`);
  await noScroll('week 26. 10. (the holiday)');
  const holiday = await page.locator('[data-testid="closed-2026-10-28"], .compact-day.is-lock-holiday, .phone-strip-day.is-lock-holiday').count();
  check(holiday > 0, `${size}: the holiday 28. 10. is drawn as a locked red day (${holiday} element(s))`);

  /* a club-held week: the first week with a club block of the first calendar (the copy's data; earlier releases consumed the first weeks) */
  const un = (j) => (j && j.data !== undefined && 'isSuccess' in j ? j.data : j);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const get = (path) => page.evaluate(async ({ path, token }) => (await (await fetch(path, { headers: { Authorization: `Bearer ${token}` } })).json()), { path, token });
  const cals = un(await get('/api/calendars')).filter((c) => c.isActive);
  let clubDay = null;
  for (let i = 0; i < 14 && !clubDay; i++) {
    const from = new Date(Date.parse('2026-10-26T12:00:00Z') + i * 7 * 86400000);
    const to = new Date(from.getTime() + 6 * 86400000);
    const blocks = un(await get(`/api/calendars/${cals[0].id}/blocks?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`));
    const club = blocks.find((b) => b.kind === 'club');
    if (club) clubDay = club.startUtc.slice(0, 10);
  }
  if (clubDay) {
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate((d) => !!document.querySelector(`[data-day="${d}"]`), clubDay)) break;
      await page.click('[data-command=nextWeek]');
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
    /* compact layouts show one day: pick the club's day */
    await page.locator(`.compact-day[data-day="${clubDay}"], .phone-strip-day[data-day="${clubDay}"]`).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, `s2-real-${size}-week-club`);
    const hold = await page.locator('[data-testid="club-window-hold"], [data-testid="phone-club-sub"]').count();
    check(hold > 0, `${size}: the club's hold state is on screen (${hold} window(s) with lock / code / state) in the week of ${clubDay}`);
    await noScroll('club-held week');
    /* the month tile (desktop / tablet) names the hold too */
    if (size !== 'phone') {
      await page.click('[data-view=month]');
      await page.waitForTimeout(1200);
      const tile = await page.locator('[data-testid^="tile-club-"]').count();
      check(tile > 0, `${size}: the month tiles carry ${tile} club bar(s)`);
      await shot(page, `s2-real-${size}-month-club`);
      await page.click('[data-view=week]');
    }
  } else check(false, `${size}: no club block in the next 14 weeks of the copy`);

  /* the selector */
  const chips = page.locator('.calendar-chip:not(.is-all)');
  const n = await chips.count();
  const sizes = [];
  for (let i = 0; i < n; i++) sizes.push(Math.round((await chips.nth(i).boundingBox()).height));
  check(n >= 2 && (!touch || sizes.every((h) => h >= 44)), `${size}: ${n} služba chips, heights ${sizes.join('/')} px${touch ? ' (touch: >= 44)' : ''}`);
  await chips.nth(1).click();
  await chips.nth(2).click();
  await page.waitForTimeout(1200);
  await shot(page, `s2-real-${size}-two-services`);
  await noScroll('two služby side by side');

  /* the lunch week */
  for (let i = 0; i < 7; i++) {
    await page.click('[data-command=nextWeek]');
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1800);
  const lunch = page.locator('[data-testid^="lunch-hit-"]').first();
  await lunch.waitFor({ timeout: 20000 }).catch(() => {});
  if (await lunch.count()) {
    const box = await lunch.boundingBox();
    console.log(`   ${size}: lunch click target ${Math.round(box.width)}x${Math.round(box.height)} px`);
    await lunch.click({ force: true }).catch(() => {});
    const pop = page.getByTestId('lunch-popover');
    if (await pop.count()) {
      await page.waitForTimeout(600); /* the popover grows in (a scale transition): measure when it has settled */
      await shot(page, `s2-real-${size}-lunch-popover`);
      const buttons = await pop.locator('button').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => [e.innerText.trim().slice(0, 24), Math.round(e.getBoundingClientRect().height)]));
      check(buttons.every(([, h]) => !touch || h >= 40), `${size}: lunch pop-out buttons ${JSON.stringify(buttons)}`);
      const pb = await pop.boundingBox();
      const vp = page.viewportSize();
      check(pb.x >= 0 && pb.x + pb.width <= vp.width + 1, `${size}: the pop-out stays inside the screen (${Math.round(pb.x)}..${Math.round(pb.x + pb.width)} of ${vp.width})`);
      await page.keyboard.press('Escape');
    } else check(false, `${size}: the lunch band opened no pop-out`);
  } else check(false, `${size}: no lunch band in the week`);
  await noScroll('lunch week');

  /* settings */
  await page.goto(`${BASE}/nastaveni/vzhled-kalendare`);
  await page.getByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' }).waitFor({ timeout: 40000 });
  await page.waitForTimeout(600);
  await shot(page, `s2-real-${size}-settings-calendar`);
  const sw = await page.getByText('Pracovník dělá jen jednu věc najednou', { exact: true }).first().boundingBox();
  check(!!sw && sw.x >= 0 && sw.x + sw.width <= page.viewportSize().width, `${size}: the shared-worker switch and its label are on screen`);
  const hw = await page.getByLabel('Barva svátků').boundingBox();
  check(!!hw && hw.x + hw.width <= page.viewportSize().width + 1, `${size}: "Barva svátků" field fits`);
  await page.goto(`${BASE}/nastaveni/kluby`);
  await page.getByLabel('Držet čas klubu do X dní před termínem').waitFor({ timeout: 40000 });
  await shot(page, `s2-real-${size}-settings-clubs`);
  const o = await overflow();
  check(o.sw <= o.iw, `${size}: club settings do not overflow sideways (${o.sw} <= ${o.iw})`);
  check(page.errors.filter((e) => !/401|negotiation|403/.test(e)).length === 0, `${size}: no console errors besides the existing hub 401 / font 403 (${page.errors.filter((e) => !/401|negotiation|403/.test(e)).slice(0, 2).join(' | ')})`);
  await page.context().close();
}
await browser.close();
console.log(failed === 0 ? '\nALL RESPONSIVE CHECKS PASS' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed);
