/*
 * deck-check - the činnost strip at the bottom of club planning, in our OWN headless Chromium.
 *
 * Owner, 21. 10. 2026: the strip showed "visible = 2" and Spiroergometrické vyšetření could not be picked. This checks, on
 * the phone (390x844), the tablet (820x1180), a mouse-only 1200x800 window (tablet layout) and the desktop (1440x900),
 * for real orders of 3, 4 and 5 činnosti and the lab's 6:
 *   - every činnost can be brought into view with the strip's own controls (edge button / crystal arrow) and armed;
 *   - every side with hidden cards fades and shows a control with the count; the live region says the same;
 *   - the escalator: arming a card brings the next new one in, the armed card stays armed;
 *   - keyboard: Tab reaches every card, End / Home walk to the ends; the controls are >= 44 px;
 *   - the page itself never scrolls and the strip does not shift the layout when a card is armed;
 *   - with the motion setting "vypnuto" the strip jumps (no glide).
 * Screenshots: design/club-planning/deck-<size>-<case>.png. Data: the club "ZZ test deck klub" (made if missing, removed at
 * the end); an order is only drafted in the planner, never saved.
 *
 *   BASE=http://localhost:3131 node scripts/club-planning/deck-check.mjs
 */
import { launch, newPage, login, api, waitPlanner, shot, BASE, OUT } from './lib.mjs';

const CLUB_NAME = 'ZZ test deck klub';
const CASES = [
  { id: '3', service: 'Sportovní lékařské prohlídky', seats: { 'Základní sportovní prohlídka': 7, 'Komplexní sportovní prohlídka': 5, 'Spiroergometrické vyšetření': 4 } },
  { id: '4', service: 'Sportovní diagnostika', seats: { 'Základní diagnostika': 6, 'Komplexní diagnostika': 4, 'VO₂max analýza': 3, 'Individuální videoinstruovaný kompenzační plán': 5 } },
  { id: '5', service: 'Zvýhodněné balíčky – prohlídka + diagnostika', seats: { 'Komplexní prohlídka + Základní diagnostika': 2, 'Komplexní prohlídka + Komplexní diagnostika': 2, 'Spiroergometrie + Základní diagnostika': 2, 'Spiroergometrie + Komplexní diagnostika': 2, 'Komplexní diagnostika + VO₂max analýza': 2 } },
  { id: '6-lab', lab: true },
];
const SIZES = [
  ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true }],
  ['tablet', { width: 820, height: 1180, isMobile: true, hasTouch: true }],
  ['tablet-mouse', { width: 1200, height: 800, isMobile: false, hasTouch: false }],
  ['desktop', { width: 1440, height: 900, isMobile: false, hasTouch: false }],
];
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);

const failures = [];
const check = (ok, what) => {
  if (!ok) failures.push(what);
  console.log(`${ok ? '  ok ' : '  FAIL'} ${what}`);
};

/** A valid Czech IČO (weights 8..2, mod 11) - a deactivated test club keeps its IČO taken. */
function randomIco() {
  const d = Array.from({ length: 7 }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
  const r = d.reduce((s, x, i) => s + x * (8 - i), 0) % 11;
  return d.join('') + String(r === 0 ? 1 : r === 1 ? 0 : 11 - r);
}

async function findOrMakeClub(page) {
  const clubs = (await api(page, 'GET', '/api/clubs')).json ?? [];
  // DELETE only deactivates a club (the API has no hard delete) and an inactive club cannot take an order: use an active one
  const found = clubs.find((c) => c.name === CLUB_NAME && c.isActive !== false);
  if (found) return found;
  const r = await api(page, 'POST', '/api/clubs', {
    name: CLUB_NAME, ico: randomIco(), paymentTermsDays: 14, contactPerson: 'Test Deck', contactEmail: 'zz-test-deck@example.invalid', contactPhone: '+420777000111',
  });
  if (r.status !== 201) throw new Error(`club not created: ${r.status}`);
  return r.json;
}

/** Club page -> "Nová objednávka klubu" -> "Vyplním sám" -> the service by name -> seats -> "Vybrat termíny v kalendáři". */
async function startOrder(page, clubId, service, seats) {
  await page.goto(`${BASE}/clubs/${clubId}`);
  await waitPlanner(page);
  await page.click('[data-testid=deck-empty-new]');
  await page.click('[data-testid=entry-phone]');
  await page.locator('[role=dialog] [role=combobox]').nth(1).click();
  await page.locator('[role=option]', { hasText: service }).first().click();
  for (const [name, n] of Object.entries(seats)) {
    const row = page.locator('[data-testid=order-activity]').filter({ hasText: name }).first();
    await row.locator('input[type=checkbox]').check();
    await page.getByLabel(`Počet hráčů, ${name}`).fill(String(n));
  }
  await page.getByRole('button', { name: 'Vybrat termíny v kalendáři' }).click();
  await page.waitForSelector('#planning-cards .plan-card', { timeout: 60000 });
  await page.waitForTimeout(1200);
}

/** Everything the strip shows, measured in the page. */
const readStrip = (page) =>
  page.evaluate(() => {
    const vp = document.querySelector('#adaptive-viewport');
    const r = vp.getBoundingClientRect();
    const visibleControl = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!b.width || cs.display === 'none' || cs.visibility === 'hidden') return null;
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { w: b.width, h: b.height, text: el.innerText.replace(/\s+/g, ' ').trim(), aria: el.getAttribute('aria-label'), hit: !!hit && el.contains(hit), disabled: el.disabled };
    };
    const cards = [...vp.querySelectorAll('.plan-card')].map((c) => {
      const b = c.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
      return {
        id: c.getAttribute('data-plan-type'),
        name: c.querySelector('.plan-card-name')?.textContent ?? '',
        inView: b.left >= r.left - 1 && b.right <= r.right + 1,
        clickable: !!hit && c.contains(hit),
        selected: c.getAttribute('aria-pressed') === 'true',
        fresh: c.getAttribute('data-fresh') === 'true',
        done: c.classList.contains('is-complete'),
        w: b.width,
        h: b.height,
      };
    });
    const ctl = (side) =>
      visibleControl(document.querySelector(`[data-deck-more="${side}"]`)) ??
      visibleControl(document.querySelector(`.precision-bracket[data-deck-nav="${side === 'before' ? -1 : 1}"]`));
    return {
      cards,
      before: vp.getAttribute('data-more-before') === 'true',
      after: vp.getAttribute('data-more-after') === 'true',
      mask: getComputedStyle(vp).maskImage || getComputedStyle(vp).webkitMaskImage,
      prev: ctl('before'),
      next: ctl('after'),
      live: document.getElementById('deck-live')?.textContent ?? '',
      page: document.getElementById('adaptive-page')?.textContent ?? '',
      visible: Number(vp.getAttribute('data-visible')),
      docScroll: document.scrollingElement.scrollHeight - innerHeight,
      deckRect: (() => { const d = document.querySelector('#planning-cards').getBoundingClientRect(); return [Math.round(d.left), Math.round(d.top), Math.round(d.width), Math.round(d.height)]; })(),
    };
  });

/** Bring the strip into the window (the compact planner scrolls inside itself; the page never does). */
async function showStrip(page) {
  await page.evaluate(() => {
    const deck = document.querySelector('#planning-cards');
    const scroller = deck.closest('.sm-planner.is-compact');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(400);
}

const settle = (page) => page.waitForTimeout(700);

async function run(browser, [sizeName, size], c, clubId) {
  const page = await newPage(browser, size);
  await login(page);
  if (c.lab) {
    await page.goto(`${BASE}/planner-lab`);
    await waitPlanner(page);
  } else {
    await startOrder(page, clubId, c.service, c.seats);
  }
  await showStrip(page);
  const label = `${sizeName}/${c.id}`;
  console.log(`\n== ${label}`);
  let s = await readStrip(page);
  const n = s.cards.length;
  console.log(`  ${n} cards, visible ${s.visible}, page "${s.page}", live "${s.live}"`);
  check(n === (c.lab ? 6 : Object.keys(c.seats).length), `${label}: every činnost has a card`);
  check(s.docScroll <= 1, `${label}: the page itself does not scroll (${s.docScroll})`);
  const inView = s.cards.filter((x) => x.inView).length;
  check(inView === Math.min(n, s.visible), `${label}: the strip says ${s.visible} fit and shows ${inView} whole`);
  const hiddenAfter = s.cards.filter((x) => !x.inView).length;
  if (hiddenAfter) {
    check(s.after && s.mask && s.mask !== 'none', `${label}: the right edge fades (${String(s.mask).slice(0, 40)})`);
    check(!!s.next && s.next.hit && !s.next.disabled, `${label}: a usable control on the right`);
    check(!!s.next && (s.next.text.includes(`ještě ${hiddenAfter}`) || (s.next.aria ?? '').includes(`ještě ${hiddenAfter}`)), `${label}: it says "ještě ${hiddenAfter}" (${s.next?.text} | ${s.next?.aria})`);
    check(!!s.next && s.next.w >= 40 && s.next.h >= 44, `${label}: the right control is a 44 px target (${Math.round(s.next?.w)}x${Math.round(s.next?.h)})`);
    check(s.live.includes(`Vpravo ještě ${hiddenAfter}`), `${label}: the live region says it`);
  } else check(!s.after, `${label}: nothing hidden, no fade`);
  await shot(page, `deck-${sizeName}-${c.id}-start`);
  await page.locator('#planning-cards').screenshot({ path: `${OUT}/deck-${sizeName}-${c.id}-strip.png` });

  // (1) every činnost reachable with the strip's own controls, then armed
  for (let i = 0; i < n; i++) {
    const target = s.cards[i];
    let guard = 0;
    while (!(s.cards[i].inView && s.cards[i].clickable) && guard++ < n + 2) {
      const forward = s.cards.findIndex((x) => x.inView) < i;
      const sel = forward ? '[data-deck-more="after"], .precision-bracket[data-deck-nav="1"]' : '[data-deck-more="before"], .precision-bracket[data-deck-nav="-1"]';
      const ctl = page.locator(sel).locator('visible=true').first();
      if (!(await ctl.count())) break;
      await ctl.click();
      await settle(page);
      s = await readStrip(page);
    }
    check(s.cards[i].inView && s.cards[i].clickable, `${label}: "${target.name}" can be brought into view and clicked`);
    if (!(s.cards[i].inView && s.cards[i].clickable)) continue;
    const before = s.deckRect.join(',');
    await page.locator(`#adaptive-viewport .plan-card[data-plan-type="${target.id}"]`).click();
    await settle(page);
    s = await readStrip(page);
    if (target.done) {
      check(!s.cards[i].selected, `${label}: the fulfilled "${target.name}" is not armed again`);
    } else {
      check(s.cards[i].selected, `${label}: "${target.name}" is armed`);
      check(s.cards[i].inView, `${label}: the armed card stays in view`);
      check(!s.cards[i].fresh, `${label}: the armed card is no longer NOVÁ`);
      // (3) the escalator: the next card never clicked is in view beside it when two fit
      const next = s.cards.findIndex((x, k) => k > i && x.fresh);
      if (next > i && next - i < s.visible) check(s.cards[next].inView, `${label}: the escalator brought "${s.cards[next].name}" in`);
    }
    check(s.deckRect.join(',') === before, `${label}: arming does not shift the strip (${before} -> ${s.deckRect.join(',')})`);
    if (i === Math.min(2, n - 1)) await shot(page, `deck-${sizeName}-${c.id}-armed`);
  }

  // (4) keyboard: Tab reaches every card; Home / End walk to the ends and bring them in
  const tabbable = await page.$$eval('#adaptive-viewport .plan-card', (els) => els.every((e) => e.tabIndex >= 0 && !e.disabled));
  check(tabbable, `${label}: every card is in the tab order`);
  await page.locator('#adaptive-viewport .plan-card').first().focus();
  await page.keyboard.press('End');
  await settle(page);
  s = await readStrip(page);
  const focusedLast = await page.evaluate(() => document.activeElement?.getAttribute('data-plan-type'));
  check(focusedLast === s.cards[n - 1].id && s.cards[n - 1].inView, `${label}: End focuses the last card and brings it in`);
  await page.keyboard.press('Home');
  await settle(page);
  s = await readStrip(page);
  check(s.cards[0].inView, `${label}: Home brings the first card back`);

  // (2) touch: a swipe / a trackpad scroll moves the strip and the counts follow
  if (n > s.visible) {
    await page.evaluate(() => { const vp = document.querySelector('#adaptive-viewport'); vp.scrollBy({ left: vp.clientWidth, behavior: 'instant' }); });
    await page.waitForTimeout(900);
    s = await readStrip(page);
    check(s.before && !!s.prev, `${label}: after a swipe the left side counts the cards it hides (${s.prev?.text} | ${s.prev?.aria})`);
  }
  await shot(page, `deck-${sizeName}-${c.id}-end`);

  // motion "vypnuto": the strip jumps
  if (n > s.visible && c.id === '3') {
    await page.evaluate(() => localStorage.setItem('sm-motion', 'vypnuto'));
    await page.reload();
    await page.waitForSelector('#planning-cards .plan-card', { timeout: 60000 }).catch(() => {});
    const has = await page.locator('#planning-cards .plan-card').count();
    if (has > s.visible) {
      await showStrip(page);
      const t = await page.evaluate(async () => {
        const vp = document.querySelector('#adaptive-viewport');
        const ctl = [...document.querySelectorAll('[data-deck-more="after"], .precision-bracket[data-deck-nav="1"]')].find((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none');
        if (!ctl) return null;
        const start = vp.scrollLeft;
        ctl.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { start, after2frames: vp.scrollLeft };
      });
      check(!!t && t.after2frames > t.start + 20, `${label}: motion vypnuto - the strip is there within two frames (${JSON.stringify(t)})`);
    } else console.log('  (the draft order did not survive a reload - motion check skipped here)');
    await page.evaluate(() => localStorage.removeItem('sm-motion'));
  }
  if (page.errors.length) console.log('  console errors:', page.errors.slice(0, 5));
  await page.context().close();
}

const browser = await launch();
const setup = await newPage(browser, 'desktop');
await login(setup);
const club = await findOrMakeClub(setup);
try {
  for (const size of SIZES) {
    for (const c of CASES) {
      if (only.length && !only.includes(size[0]) && !only.includes(c.id)) continue;
      try {
        await run(browser, size, c, club.id);
      } catch (e) {
        check(false, `${size[0]}/${c.id}: ${String(e.message).split('\n')[0]}`);
      }
    }
  }
} finally {
  if (!process.env.KEEP_CLUB) {
    const del = await api(setup, 'DELETE', `/api/clubs/${club.id}`);
    console.log(`\ndeactivated ${CLUB_NAME} ${club.id}: ${del.status}`);
  }
  await browser.close();
}
console.log(`\n${failures.length ? `FAILED ${failures.length}` : 'ALL OK'}`);
for (const f of failures) console.log(' - ' + f);
process.exitCode = failures.length ? 1 : 0;
