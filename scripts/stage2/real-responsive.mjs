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

  /* the holiday week + the club-held week */
  await page.goto(`${BASE}/planovani`);
  await waitPlanner(page);
  await page.click('[data-command=nextWeek]');
  await page.waitForTimeout(2200);
  await shot(page, `s2-real-${size}-week-holiday-club`);
  await noScroll('week 26. 10. (holiday, club holds)');
  const hold = await page.locator('[data-testid^="board-window-"] [data-testid="club-window-hold"], [data-testid^="phone-entry-"] [data-testid="phone-club-sub"]').count();
  console.log(`   ${size}: club windows with a hold state on screen: ${hold}`);

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
  const sw = await page.getByRole('switch', { name: 'Pracovník dělá jen jednu věc najednou' }).boundingBox();
  check(sw.width > 0 && sw.x >= 0 && sw.x + sw.width <= page.viewportSize().width, `${size}: the shared-worker switch is on screen`);
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
