/*
 * Stage 5c - the club planning guide, in our OWN headless Chromium on the local stack. One run per layout
 * (phone 390x844, tablet 820x1180, desktop 1440x900); JPEG screenshots in design/stage5c/.
 *
 *   BASE=http://localhost:3012 OUT=design/stage5c node scripts/stage5c/guide-check.mjs [phone tablet desktop]
 *
 * Triggers checked: (a) the start hint, (b) the next činnost on the completion card, (c) "Připravit formulář" as the
 * highlighted action with a pulse that obeys the Animace setting, (d) the three numbered steps of the publish dialog,
 * (e) the refusal sentences, (f) the strip hint for 4+ činnosti and the 20 s gap; then item 2: the generated link opened in a
 * fresh browser context. Test data: the club 'ZZ test plánování' (orders are cancelled at the end).
 */
import { mkdirSync } from 'node:fs';
import { launch, newPage, login, api, findOrMakeClub, toasts, SIZES, BASE, OUT } from '../club-planning/lib.mjs';

mkdirSync(OUT, { recursive: true });
const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['phone', 'tablet', 'desktop'];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const text = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
const snap = (page, size, name) => page.screenshot({ path: `${OUT}/${size}-${name}.jpg`, type: 'jpeg', quality: 55 });
const dayEl = (page, d) => page.locator(`.month-tile[data-day="${d}"], [data-testid="phone-month-day-${d}"]`).first();

let phoneNav = false;
async function toMonth(page, heading) {
  await page.getByRole('button', { name: 'Měsíc', exact: true }).first().click();
  await page.waitForSelector('.alternative-head');
  for (let i = 0; i < 24; i++) {
    const h = await text(page, '.alternative-head');
    if (h.startsWith(heading)) return;
    const next = page.getByRole('button', { name: phoneNav ? 'Následující týden' : 'Následující měsíc' }).first();
    if (!(await next.count())) phoneNav = true;
    await (phoneNav ? page.getByRole('button', { name: 'Následující týden' }) : next).first().click();
    await page.waitForTimeout(phoneNav ? 350 : 700);
  }
  throw new Error(`month ${heading} not reached`);
}

async function noOverflow(page, label) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  check(m.sw <= m.iw && m.sh <= m.ih + 1, `${label}: no overflow, the document does not scroll (${m.sw}x${m.sh} in ${m.iw}x${m.ih})`);
}

/** Every visible button / link inside `root` is at least 44 px high and wide (the card's own controls). */
async function targets44(page, root, label) {
  if (page.viewportSize().width >= 1280) return; // the desktop stage is a mouse layout; the 44 px rule is for touch
  const small = await page.$$eval(`${root} button`, (els) =>
    els.filter((e) => e.getClientRects().length).map((e) => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) }; }).filter((b) => b.h < 44 || b.w < 44));
  check(small.length === 0, `${label}: every button is at least 44 px (${small.length ? JSON.stringify(small) : 'all ok'})`);
}

async function inViewport(page, sel, label) {
  const r = await page.locator(sel).first().boundingBox();
  const vp = page.viewportSize();
  check(!!r && r.x >= -1 && r.y >= -1 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1, `${label}: inside the window (${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : 'missing'})`);
}

/** Club page -> "Nová objednávka klubu" -> "Vyplním sám" -> the service by name -> seats -> "Vybrat termíny v kalendáři". */
async function startOrder(page, clubId, service, seats) {
  await page.goto(`${BASE}/clubs/${clubId}/kalendar`);
  await page.waitForSelector('.sm-planner', { timeout: 90000 });
  await page.waitForSelector('[data-testid=club-planner-loading]', { state: 'detached', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click('[data-testid=ov-new-order], [data-testid=deck-empty-new]');
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

/** Bring the strip into the window (the compact planner scrolls inside itself; the page never does). */
async function showStrip(page) {
  await page.evaluate(() => {
    const scroller = document.querySelector('#planning-cards')?.closest('.sm-planner.is-compact');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(400);
}

async function flow(browser, size) {
  console.log(`\n=== ${size} ${SIZES[size].width}x${SIZES[size].height}`);
  const page = await newPage(browser, size);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }).catch(() => {});
  await login(page);
  const club = await findOrMakeClub(page);
  await startOrder(page, club.id, 'Sportovní lékařské prohlídky', { 'Základní sportovní prohlídka': 2, 'Komplexní sportovní prohlídka': 2 });

  /* (a) an empty order: one calm hint with the real gestures */
  await page.waitForSelector('[data-testid=guide-hint]', { timeout: 20000 });
  const a = await text(page, '[data-testid=guide-hint]');
  check(/Vyberte činnost/.test(a) && (size === 'phone' ? /celý/.test(a) : /táhněte v kalendáři/.test(a)), `(a) start hint: "${a.slice(0, 110)}"`);
  await showStrip(page); // the phone's strip (and the hint above it) lies below the fold
  check((await page.locator('[data-testid=guide-hint]').count()) === 1, '(a) exactly one hint');
  await snap(page, size, 'a-start');
  await inViewport(page, '[data-testid=guide-hint]', '(a) hint');
  await targets44(page, '[data-testid=guide-hint]', '(a) hint');
  await noOverflow(page, '(a)');

  /* (e) refusals say what to do: a closed day (the month of January 2027 holds New Year) */
  await page.locator('.plan-card', { hasText: 'Základní' }).first().click();
  await toMonth(page, 'Leden 2027');
  const armed = await page.locator('[data-testid=guide-hint]').first().innerText().catch(() => '');
  check(/Činnost je vybraná|Vyberte činnost dole/.test(armed), `(a) the hint follows the state: "${armed.replace(/\s+/g, ' ').slice(0, 90)}"`);
  await dayEl(page, '2027-01-01').click();
  await page.waitForTimeout(700);
  const closed = (await toasts(page)).join(' ');
  check(/zavřeno|nemá ordinační dobu/.test(closed) && /Zvolte jiný den/.test(closed), `(e) a closed day: "${closed.slice(-110)}"`);
  await snap(page, size, 'e-closed-day');

  /* (b) the armed činnost is fulfilled by one click on a day: the next one is offered */
  await dayEl(page, '2027-01-12').click();
  await page.waitForSelector('[data-testid=completion-callout]:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(1500);
  const b = await text(page, '[data-testid=completion-callout]');
  check(/Požadavek naplněn/.test(b) && /Další: Komplexní/.test(b), `(b) the callout offers the next činnost: "${b.slice(0, 140)}"`);
  check((await page.locator('[data-testid=guide-hint]').count()) === 0, '(b) no hint next to the callout');
  await snap(page, size, 'b-next');
  await inViewport(page, '[data-testid=completion-callout]', '(b) callout');
  await targets44(page, '[data-testid=completion-callout]', '(b) callout');
  await page.locator('[data-completion-another]').click();
  await page.waitForTimeout(500);
  const armedCard = await page.locator('.plan-card.is-selected .plan-card-name').first().innerText().catch(() => '');
  check(/Komplexní/.test(armedCard), `(b) the button armed the offered činnost ("${armedCard}")`);

  /* (c) the whole order: "Připravit formulář" is the highlighted action, with a pulse that obeys Animace */
  await dayEl(page, '2027-01-13').click();
  await page.waitForSelector('[data-testid=completion-callout]:not([hidden]) [data-completion-prepare]', { timeout: 8000 });
  await page.waitForTimeout(1500);
  const c = await text(page, '[data-testid=completion-callout]');
  check(/Celá objednávka naplánována/.test(c) && /Připravit formulář/.test(c) && /odkaz pro klub/.test(c), `(c) the callout: "${c.slice(0, 200)}"`);
  const motion = await page.evaluate(() => document.documentElement.dataset.motion);
  const anim = (m) => page.evaluate((mode) => { document.documentElement.dataset.motion = mode; return getComputedStyle(document.querySelector('[data-completion-prepare]')).animationName; }, m);
  const full = await anim('full');
  const reduced = await anim('reduced');
  const off = await anim('off');
  check(full === 'guide-pulse' && reduced === 'none' && off === 'none', `(c) the pulse plays only under plné (plné ${full}, omezené ${reduced}, vypnuto ${off})`);
  await page.evaluate((m) => { document.documentElement.dataset.motion = m ?? 'full'; }, motion);
  await page.waitForTimeout(700); // the card's own entrance restarts when the motion attribute is put back
  const settled = await page.evaluate(() => { const el = document.querySelector('.completion-card'); const cs = getComputedStyle(el); return { opacity: cs.opacity, anim: cs.animationName, state: cs.animationPlayState, transform: cs.transform }; });
  check(settled.opacity === '1', `(c) the card is fully opaque when settled (${JSON.stringify(settled)})`);
  await snap(page, size, 'c-prepare');
  await inViewport(page, '[data-completion-prepare]', '(c) button');
  await targets44(page, '[data-testid=completion-callout]', '(c) callout');
  await noOverflow(page, '(c)');

  /* (e) a fulfilled order refuses more days, and says what to do */
  await page.locator('[data-completion-another]').click().catch(() => {}); // "Zavřít"
  await dayEl(page, '2027-01-14').click();
  await page.waitForTimeout(700);
  const need = (await toasts(page)).join(' ');
  check(/naplněna|nepotřebuje|už mají termín/.test(need) && /Přidat termín navíc/.test(need), `(e) a fulfilled order: "${need.slice(-120)}"`);
  await snap(page, size, 'e-need-met');

  /* (d) "Připravit formulář" -> three numbered steps */
  await page.locator('[data-publish-launch], #finish-plan').filter({ visible: true }).first().click();
  await page.waitForSelector('[data-testid=publish-steps]');
  const step = (n) => page.locator(`[data-testid=publish-steps] [data-step="${n}"]`).getAttribute('data-state');
  check((await step(1)) === 'current' && (await step(2)) === 'locked' && (await step(3)) === 'locked', '(d) step 1 is the current one, 2 and 3 wait');
  check(await page.locator('#pub-see-email').isDisabled() && (await page.locator('#pub-copy').isDisabled()) && (await page.locator('#pub-copy-email').isDisabled()), '(d) the later buttons are disabled');
  const why2 = await text(page, '[data-testid=publish-why-2]');
  const why3 = await text(page, '[data-testid=publish-why-3]');
  check(/vygenerujte odkaz/.test(why2) && /vygenerujte odkaz/.test(why3), `(d) every disabled button says why ("${why2}" / "${why3}")`);
  await snap(page, size, 'd1-steps');
  await noOverflow(page, '(d1)');
  await targets44(page, '[role=dialog] .pub-actions', '(d1) dialog actions');
  await page.click('#pub-generate');
  await page.waitForFunction(() => document.querySelector('[data-testid=publish-link]')?.getAttribute('data-url'), null, { timeout: 30000 });
  const link = await page.locator('[data-testid=publish-link]').getAttribute('data-url');
  check(/^https?:\/\/[^/]+\/klub-objednavka\/[\w-]{20,}$/.test(link), `(R11) the link is the full address + route + token (${link.replace(/[\w-]{30,}/, '<token>')})`);
  check((await step(1)) === 'done' && (await step(2)) === 'current' && (await step(3)) === 'locked', '(d) after generating: step 2 is the current one');
  check(await page.locator('#pub-see-email').isEnabled(), '(d) the e-mail preview is open now');
  await snap(page, size, 'd2-generated');
  await page.click('#pub-see-email');
  await page.waitForSelector('[data-testid=email-draft]');
  const mail = await text(page, '[data-testid=email-draft]');
  check(mail.includes(link), '(R11) the e-mail preview holds the full link');
  await snap(page, size, 'd3-email');
  await page.click('#return-to-publish');
  await page.waitForSelector('[data-testid=publish-steps]');
  check((await step(2)) === 'done' && (await step(3)) === 'current', '(d) after the preview: step 3 is the current one');
  check(await page.locator('#pub-copy').isEnabled() && (await page.locator('#pub-copy-email').isEnabled()), '(d) the copy buttons are open now');
  await snap(page, size, 'd4-copy-open');
  await page.click('#pub-copy');
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERR ${e.message}`);
  check(copied === link, '(R11) "Kopírovat odkaz" copied the full link');
  check((await step(3)) === 'done', '(d) step 3 is done after copying');
  await page.click('[data-testid=publish-link-copy]');
  await page.waitForTimeout(300);
  check((await page.locator('[data-testid=publish-link-copy]').getAttribute('data-copy-state')) === 'copied', '(R11) the copy button beside the link says "Zkopírováno"');
  await snap(page, size, 'd5-done');
  await noOverflow(page, '(d5)');

  /* item 2: the copied link, opened in a fresh browser context (no sign-in, no storage) */
  const fresh = await newPage(browser, size);
  await fresh.goto(link);
  await fresh.waitForTimeout(4500);
  const body = (await fresh.locator('body').innerText()).replace(/\s+/g, ' ');
  check(!/Odkaz neplatí|už není platný|vypršel/i.test(body) && /Objednávka pro klub/.test(body), `(R11) the link opens the club's form in a fresh context ("${body.slice(0, 120)}")`);
  await snap(fresh, size, 'd6-link-opened');
  check(fresh.errors.filter((e) => !/favicon|manifest/.test(e)).length === 0, `(R11) the opened link has no console error (${fresh.errors.join(' | ').slice(0, 160)})`);

  check(page.errors.length === 0, `${size}: no console error (${page.errors.join(' | ').slice(0, 200)})`);
  await page.context().close();
  await fresh.context().close();
}

/** (f) 4+ činnosti: the strip hint, one at a time, never within 20 s of the previous one. */
async function stripFlow(browser, size) {
  console.log(`\n=== ${size} strip hint`);
  const page = await newPage(browser, size);
  await login(page);
  const club = await findOrMakeClub(page);
  const t0 = Date.now();
  await startOrder(page, club.id, 'Sportovní diagnostika', { 'Základní diagnostika': 2, 'Komplexní diagnostika': 2, 'VO₂max analýza': 2, 'Individuální videoinstruovaný kompenzační plán': 2 });
  check((await page.locator('#planning-cards .plan-card').count()) === 4, '(f) the order has 4 činnosti');
  await page.waitForSelector('[data-testid=guide-hint]', { timeout: 20000 });
  const first = await page.locator('[data-testid=guide-hint]').getAttribute('data-hint');
  const tStart = Date.now();
  check(first === 'start', `(f) the start hint comes first, alone (${first})`);
  /* the person does what the hint said: the start hint is settled, the strip hint must still wait out the gap */
  await page.locator('.plan-card').first().click();
  await toMonth(page, 'Leden 2027');
  await dayEl(page, '2027-01-12').click();
  await page.waitForTimeout(1500);
  await page.locator('[data-completion-close]').click().catch(() => {});
  const early = await page.locator('[data-testid=guide-hint][data-hint=strip]').count();
  check(early === 0 || Date.now() - tStart >= 20000, '(f) the strip hint does not follow the start hint within 20 s');
  await page.waitForSelector('[data-testid=guide-hint][data-hint=strip]', { timeout: 40000 });
  const gap = Date.now() - tStart;
  check(gap >= 19000, `(f) the strip hint appeared ${Math.round(gap / 1000)} s after the start hint (>= 20 s)`);
  check((await page.locator('[data-testid=guide-hint]').count()) === 1, '(f) still exactly one hint');
  const t = await text(page, '[data-testid=guide-hint]');
  check(/Činností je víc, než se vejde/i.test(t) && /Ještě \d+/i.test(t), `(f) strip hint: "${t.slice(0, 140)}"`);
  await showStrip(page);
  await snap(page, size, 'f-strip');
  await inViewport(page, '[data-testid=guide-hint]', '(f) hint');
  await targets44(page, '[data-testid=guide-hint]', '(f) hint');
  /* x remembers it: reload the planner, no hint comes back for this person */
  await page.click('[data-guide-close]');
  const mem = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('sm-planner-hints:')).map(([, v]) => v));
  check(mem.length === 1 && JSON.parse(mem[0]).seen.strip === true && JSON.parse(mem[0]).seen.start === true, `(f) remembered per user: ${mem[0]}`);
  void t0;
  await page.context().close();
}

const browser = await launch();
try {
  if (!process.env.ONLY_STRIP) for (const size of sizes) await flow(browser, size);
  if (!process.env.NO_STRIP) for (const size of process.env.ONLY_STRIP ? sizes : [sizes.includes('desktop') ? 'desktop' : sizes[0]]) await stripFlow(browser, size);
} finally {
  await browser.close();
  const p = await launch();
  const pg = await newPage(p, 'desktop');
  await login(pg);
  const club = await findOrMakeClub(pg);
  const orders = (await api(pg, 'GET', `/api/v1/club-orders?clubId=${club.id}`)).json ?? [];
  for (const o of orders.filter((x) => x.status !== 'Cancelled')) {
    const r = await api(pg, 'POST', `/api/v1/club-orders/${o.id}/cancel?cancelAthletes=false`, {});
    console.log('cancelled test order', o.id.slice(0, 8), r.status);
  }
  await p.close();
}
console.log(failures.length ? `\n${failures.length} FAILED:\n- ${failures.join('\n- ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
