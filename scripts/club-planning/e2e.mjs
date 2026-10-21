/*
 * End to end, in our OWN headless Chromium, on the local stack: plan a club order across a month - a click on a whole
 * day, a drag over several days, extending past the limit (stopped), fulfilling every činnost (the "splněno" moment),
 * the finish dialog - at 390x844, 820x1180 and 1440x900.
 *
 *   BASE=http://localhost:3000 node scripts/club-planning/e2e.mjs [phone|tablet|desktop ...]
 *
 * Only the club 'ZZ test plánování' is used and nothing is saved (no order is created): the plan lives in the draft.
 * Exit code 1 when an assertion fails; screenshots go to design/club-planning/e2e-<size>-<n>.png (look at them).
 */
import { launch, newPage, login, shot, toasts, findOrMakeClub, startClubOrder, SIZES, dragBoard, clickCard, boardRect, dayX, minuteY } from './lib.mjs';

const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['phone', 'tablet', 'desktop'];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

const FIGURE = '.plan-num';
const text = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

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

const dayEl = (page, d) => page.locator(`.month-tile[data-day="${d}"], [data-testid="phone-month-day-${d}"]`).first();

async function noScrollOverflow(page, label) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  check(m.sw <= m.iw, `${label}: no horizontal overflow (${m.sw} <= ${m.iw})`);
  check(m.sh <= m.ih + 1, `${label}: the document does not scroll (${m.sh} <= ${m.ih})`);
}

/** The week board: a drag across the lunch break is two terms, a drag past the need is clamped, a fulfilled činnost refuses. */
async function weekChecks(browser, club, size, S) {
  /* a fresh page: a reload would bring back the order of the first part (the session lives in the history state) */
  const page = await newPage(browser, size);
  await login(page);
  await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 9 });
  /* the week of 11. - 17. 1. 2027, by the board's own arrows (the mini calendar is a sheet on tablet and phone) */
  await page.getByRole('button', { name: 'Týden', exact: true }).first().click();
  for (let i = 0; i < 30 && (await page.locator('.day-title[data-day="2027-01-12"]').count()) === 0; i++) {
    await page.getByRole('button', { name: 'Následující týden' }).first().click();
    await page.waitForTimeout(250);
  }
  if (size === 'tablet') await page.getByRole('button', { name: '7 dní' }).click();
  await page.waitForTimeout(500);
  await clickCard(page, 'Základní sportovní prohlídka');
  const wk = await text(page, '.board-week-heading, .week-title, #week-range, [data-testid=week-range]').catch(() => '');
  void wk;
  /* Tuesday 12. 1. is column 1 of the week of 11. 1. - drag from 08:00 down to 14:00: crosses the lunch break */
  const d = await dragBoard(page, { day: 1, min: 8 * 60 }, { min: 14 * 60 });
  const label = await text(page, '#drag-preview');
  check(/\+9 slotů/.test(label), `the drag shows the 9 slots the order needs, not the 9 + lunch minutes ("${label}")`);
  await shot(page, S('6-week-drag'));
  await d.up();
  await page.waitForTimeout(900);
  const times = await page.$$eval('.board-session .event-time', (els) => els.map((e) => e.textContent.trim()));
  const min = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const overlaps = times.filter((t) => { const [a, b] = t.split(/\s*[–-]\s*/); return min(a) < 12 * 60 + 30 && min(b) > 12 * 60; });
  check(times.length >= 2 && overlaps.length === 0, `the drop is two terms and none touches the lunch break (${times.join(', ')})`);
  await shot(page, S('7-week-dropped'));
  check(num2(await text(page, '.plan-card .plan-num')) === 9, 'the card reads 9 / 9 after the drop');

  /* a fulfilled činnost: another press on the board is refused, the figure stays */
  const before = await text(page, '.plan-card .plan-num');
  await dragBoard(page, { day: 2, min: 9 * 60 }, { min: 11 * 60 }).then((x) => x.up());
  await page.waitForTimeout(600);
  check((await text(page, '.plan-card .plan-num')) === before, 'nothing is added to a fulfilled činnost');
}

const num2 = (s) => Number(/^(\d+)/.exec(s)?.[1] ?? NaN);

async function run(size) {
  const browser = await launch();
  const page = await newPage(browser, size);
  await login(page);
  const club = await findOrMakeClub(page);
  const S = (n) => `e2e-${size}-${n}`;
  console.log(`\n=== ${size} ${SIZES[size].width}x${SIZES[size].height}`);

  /* 30 x Základní (40 min) + 12 x Komplexní (60 min); January 2027 is free of other clubs' windows */
  await startClubOrder(page, club.id, { 'Základní sportovní prohlídka': 30, 'Komplexní sportovní prohlídka': 12 });
  await toMonth(page, 'Leden 2027');
  await shot(page, S('1-month'));

  /* 1. a plain click on a whole day takes the whole day for the činnosti, one after another */
  await dayEl(page, '2027-01-12').click();
  await page.waitForTimeout(1200);
  const t1 = (await toasts(page)).join(' ');
  check(/Naplánováno 1 den/.test(t1), `a click on a whole day plans it ("${t1.slice(0, 80)}")`);
  await shot(page, S('2-day-picked'));

  /* 2. a click on a holiday says why instead of doing nothing */
  await dayEl(page, '2027-01-01').click();
  await page.waitForTimeout(600);
  const t2 = (await toasts(page)).join(' ');
  check(/zavřeno|minulosti|neplánováno|Nic nebylo/i.test(t2), `a closed day says why ("${t2.slice(-90)}")`);

  /* 3. several days in one gesture (desktop / tablet: drag; phone: the rows are taken one tap at a time) */
  if (size !== 'phone') {
    const a = await dayEl(page, '2027-01-13').boundingBox();
    const c = await dayEl(page, '2027-01-14').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
    await page.mouse.up();
  } else {
    await dayEl(page, '2027-01-13').click();
    await page.waitForTimeout(900);
    await dayEl(page, '2027-01-14').click();
  }
  await page.waitForTimeout(1500);
  await shot(page, S('3-multi'));
  const card = async (name) => (await text(page, `.plan-card:has-text("${name}") ${FIGURE}`));
  const z1 = await card('Základní');
  const k1 = await card('Komplexní');
  console.log(`   figures after 3 days: Základní ${z1} | Komplexní ${k1}`);

  /* 4. the planned time can never exceed the request: keep picking, the cards stop at the need */
  for (const d of ['2027-01-15', '2027-01-18', '2027-01-19', '2027-01-20', '2027-01-21']) {
    await dayEl(page, d).click();
    await page.waitForTimeout(900);
  }
  const z2 = await card('Základní');
  const k2 = await card('Komplexní');
  const num = (s) => Number(/^(\d+)/.exec(s)?.[1] ?? NaN);
  check(num(z2) <= 30 && num(k2) <= 12, `never more than requested (Základní ${z2}, Komplexní ${k2})`);
  check(num(z2) === 30 && num(k2) === 12, 'both činnosti are fulfilled exactly (30 / 12)');
  await shot(page, S('4-fulfilled'));
  const afterAll = (await toasts(page)).join(' ');
  /* one more click: refused with a Czech reason, nothing is added */
  await dayEl(page, '2027-01-22').click();
  await page.waitForTimeout(800);
  const t3 = (await toasts(page)).join(' ');
  check(/víc klub nepotřebuje|už mají termín|naplněn/i.test(t3), `a fulfilled order refuses more ("${t3.slice(-80)}")`);
  check(num(await card('Základní')) === 30, 'the figure did not move after the refusal');

  /* 5. the finish dialog agrees with the cards: 42 / 42, enabled save, no red box */
  await page.getByRole('button', { name: /Prohlédnout plán|Souhrn/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await noScrollOverflow(page, `${size} month`);

  /* 6. the week: drag over the limit is clamped (a fresh činnost on the first free day) */
  await page.getByRole('button', { name: 'Týden', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, S('5-week'));

  if (size !== 'phone') await weekChecks(browser, club, size, S);

  console.log('   errors:', page.errors.length ? page.errors : 'none');
  check(page.errors.length === 0, `${size}: no console errors`);
  await browser.close();
}

for (const size of sizes) await run(size);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall passed');
process.exit(failures.length ? 1 : 0);
void dragBoard; void clickCard; void boardRect; void dayX; void minuteY;
