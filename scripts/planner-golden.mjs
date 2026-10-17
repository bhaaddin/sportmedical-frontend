/*
 * Generates the golden numbers the planner's pure logic is pinned to.
 *
 * The partner's prototype (design/planner-v65.html) keeps every function inside
 * one IIFE. This script copies the file to a temp folder, appends a block that
 * exposes the closure's functions and state as `window.__proto`, opens it in
 * headless Chromium with a FIXED clock (2026-11-10) and records what the
 * prototype itself answers for a set of inputs. The result is written to
 *
 *     src/planner/model/__golden__/prototype.json
 *
 * and `src/planner/model/golden.test.ts` replays every case through the
 * TypeScript port and expects the same answer. Re-run only when the prototype
 * file changes:
 *
 *     node scripts/planner-golden.mjs
 *
 * Needs playwright-core and a Chromium. Both are looked up in this order:
 *   PLAYWRIGHT_CORE (path to the playwright-core folder) or `import 'playwright-core'`;
 *   CHROME_PATH or the ms-playwright cache of the current user.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protoPath = join(root, 'design', 'planner-v65.html');
const outPath = join(root, 'src', 'planner', 'model', '__golden__', 'prototype.json');

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE, 'playwright-core'].filter(Boolean);
  for (const c of candidates) {
    try {
      const spec = c.includes('/') || c.includes('\\') ? pathToFileURL(join(resolve(c), 'index.js')).href : c;
      return await import(spec);
    } catch { /* try next */ }
  }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE=<path to playwright-core>.');
}

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium-'))) {
      const p = join(base, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found. Set CHROME_PATH.');
}

const EXPOSE = `
  window.__proto = {
    state, planState, movingEvent, resizingEvent, agendaUI, demandData, category, initialEvents, board,
    computeDayPlan, miniContent, bookingState, dayReservationSummary, tooltipMarkup, plannedFrom, plannedOf, totals,
    validatePlacement, selectionFromPointer, canSafelyMerge, collectAdjacentBlocks, addPlannedInterval,
    validateTermMove, proposalForMove, validateTermExpansion, proposalForTermExpansion, s41Snapshot,
    agendaEvents, renderAppointments, render, selectDay, previousWeek, changeMonth, setFilter, setView, today,
    isoWeek, timeLeft, clockDuration, agendaHours, detailedDate, makeSlots, slotsAfterExpansion,
    shiftedInternalSlots, smartSlotShift, adaptivePendingMinutes, listVisible, sourceFor, confirmTermMovement,
    commitTermExpansion, updateOrderCommand, renderPlanningActivities, renderWeekEvents, renderWeekHead,
    setBudget:(n)=>{DAY_BUDGET_MINUTES=n;}, dateOf, iso, shift
  };
`;

const instrumented = readFileSync(protoPath, 'utf8').replace(
  'window.__miniFocusTest={',
  EXPOSE + '\n    window.__miniFocusTest={',
);
if (!instrumented.includes('window.__proto')) throw new Error('Could not inject the exposure block.');

const dir = mkdtempSync(join(tmpdir(), 'planner-golden-'));
const file = join(dir, 'proto.html');
writeFileSync(file, instrumented, 'utf8');

const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default?.chromium;
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, locale: 'cs-CZ' });
const page = await context.newPage();
await page.clock.setFixedTime(new Date(2026, 10, 10, 12, 0, 0));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => !!window.__proto);

/* Everything below runs INSIDE the prototype page. */
const golden = await page.evaluate(() => {
  const P = window.__proto;
  const clone = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
  const out = {};
  const fresh = () => {
    P.state.events = clone(P.initialEvents);
    P.state.filter = 'all';
    P.state.view = 'week';
    P.planState.selectedType = null;
    P.planState.dragging = null;
    P.setBudget(720);
    P.selectDay('2026-11-20');
  };
  const ev = (id, date, start, end, type, capacity, extra = {}) =>
    ({ id, date, start, end, type, capacity, booked: 0, showInList: true, ...extra });

  fresh();
  out.initialEvents = clone(P.initialEvents);
  out.demand = clone(P.demandData);
  out.category = clone(P.category);
  out.categoryOrder = Object.keys(P.category);

  /* ---- pure helpers ---- */
  out.helpers = {
    timeLeft: [0, 20, 45, 60, 90, 125, 600, 1440].map((n) => [n, P.timeLeft(n)]),
    clockDuration: [0, 5, 60, 61, 125].map((n) => [n, P.clockDuration(n)]),
    agendaHours: [0, -5, 20, 60, 90, 725].map((n) => [n, P.agendaHours(n)]),
    isoWeek: ['2026-01-01', '2026-11-16', '2026-11-22', '2026-12-28', '2027-01-03', '2025-12-29', '2024-12-30'].map((d) => [d, P.isoWeek(P.dateOf(d))]),
    detailedDate: ['2026-11-20', '2026-11-22', '2026-12-01'].map((d) => [d, P.detailedDate(d)]),
    makeSlots: [['09:00', 3, 20], ['13:30', 2, 45]].map(([s, q, d]) => [s, q, d, P.makeSlots(s, q, d)]),
  };

  /* ---- day plan: every day of Nov 2026 + neighbours ---- */
  const days = [];
  for (let i = -6; i < 40; i++) days.push(P.iso(P.shift(P.dateOf('2026-10-26'), i)));
  const strip = (p) => ({
    date: p.date, minutes: p.minutes, ratio: p.ratio, percent: p.percent, slots: p.slots,
    entries: p.entries.map((e) => ({ id: e.id, type: e.type, start: e.start, end: e.end, capacity: e.capacity, extraPreview: e.extraPreview, date: e.date })),
    slices: p.slices,
  });
  out.dayPlan = { budget: 720, days: days.map((d) => strip(P.computeDayPlan(d))) };
  out.miniContent = days.filter((d) => P.computeDayPlan(d).entries.length).map((d) => [d, P.miniContent(d)]);
  P.setBudget(480);
  out.dayPlanBudget480 = ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22'].map((d) => ({ plan: strip(P.computeDayPlan(d)), html: P.miniContent(d) }));
  P.setBudget(1440);
  out.dayPlanBudget1440 = ['2026-11-16', '2026-11-18', '2026-11-20'].map((d) => ({ plan: strip(P.computeDayPlan(d)), html: P.miniContent(d) }));
  P.setBudget(720);

  const mk = (kind, extra) => ({ kind, validation: { ok: true, reason: '' }, ...extra });
  const previews = [
    { name: 'place-empty-day', preview: mk(undefined, { date: '2026-11-25', type: 'medical', start: '09:00', end: '11:00', quantity: 6 }) },
    { name: 'place-same-day', preview: mk(undefined, { date: '2026-11-18', type: 'physio', start: '13:00', end: '14:00', quantity: 2 }) },
    { name: 'place-invalid', preview: { validation: { ok: false, reason: 'x' }, date: '2026-11-18', type: 'physio', start: '13:00', end: '14:00', quantity: 2 } },
    { name: 'move-valid-new-day', preview: mk('move', { eventId: 'm1', date: '2026-11-24', start: '08:00', end: '10:00' }) },
    { name: 'move-valid-same-day', preview: mk('move', { eventId: 'm1', date: '2026-11-18', start: '14:00', end: '16:00' }) },
    { name: 'move-invalid', preview: { kind: 'move', validation: { ok: false, reason: 'x' }, eventId: 'm1', date: '2026-11-24', start: '08:00', end: '10:00' } },
    { name: 'resize-valid', preview: mk('resize', { eventId: 'm2', date: '2026-11-19', start: '12:20', end: '14:30', capacity: 12 }) },
  ];
  out.dayPlanPreview = previews.map(({ name, preview }) => ({
    name, preview: clone(preview),
    days: ['2026-11-18', '2026-11-19', '2026-11-24', '2026-11-25'].map((d) => ({ plan: strip(P.computeDayPlan(d, preview)), html: P.miniContent(d, preview) })),
  }));

  /* ---- tooltip ---- */
  out.tooltip = ['2026-11-18', '2026-11-20', '2026-11-22', '2026-11-16'].map((d) => {
    const host = document.createElement('div');
    host.innerHTML = P.tooltipMarkup(d);
    const t = (sel) => [...host.querySelectorAll(sel)].map((n) => n.textContent.trim().replace(/\s+/g, ' '));
    return {
      date: d,
      heading: t('.tday-heading h3')[0] ?? null,
      pct: t('.tday-pct')[0] ?? null,
      caption: t('.tday-caption span'),
      stats: t('.tday-stat'),
      events: t('.tday-event'),
      bars: [...host.querySelectorAll('.tday-bar i')].map((n) => n.getAttribute('style')),
    };
  });

  /* ---- bookings ---- */
  const bookingVariants = [
    ev('b1', '2026-11-30', '09:00', '10:00', 'medical', 10, { booked: 3 }),
    ev('b2', '2026-11-30', '10:00', '11:00', 'medical', 10, { booked: 3, demoClub: 4, demoPublic: 2 }),
    ev('b3', '2026-11-12', '09:00', '10:00', 'medical', 10, { booked: 3 }), // cutoff 5.11. <= today: released
    ev('b4', '2026-11-17', '09:00', '10:00', 'medical', 10, { booked: 0 }), // cutoff 10.11. == today: released
    ev('b5', '2026-11-18', '09:00', '10:00', 'medical', 10, { booked: 0 }), // cutoff 11.11. > today: held
    ev('b6', '2026-11-30', '12:00', '13:00', 'fitness', 4, { origin: 'public', booked: 3 }),
    ev('b7', '2026-11-30', '13:00', '14:00', 'fitness', 4, { origin: 'public', booked: 9 }),
    ev('b8', '2026-11-30', '14:00', '15:00', 'fitness', 4, { origin: 'public', booked: 2, demoPublic: 1, demoClub: 3 }),
    ev('b9', '2026-11-30', '15:00', '16:00', 'medical', 6, { booked: 2, demoReleased: true }),
    ev('b10', '2026-11-30', '16:00', '17:00', 'medical', 6, { booked: 2, demoClub: 9, demoPublic: 9 }),
  ];
  out.booking = bookingVariants.map((e) => ({ event: clone(e), state: clone(P.bookingState(e)) }));
  out.bookingInitial = clone(P.initialEvents).map((e) => ({ event: e, state: clone(P.bookingState(e)) }));
  P.state.events = [...clone(P.initialEvents), ...bookingVariants];
  out.daySummary = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-30', '2026-11-16', '2026-11-27'].map((d) => [d, clone(P.dayReservationSummary(d))]);
  fresh();

  /* ---- planned / totals in several states ---- */
  const states = {
    initial: () => {},
    removedM1: () => { P.state.events = P.state.events.filter((e) => e.id !== 'm1'); },
    enlargedM2: () => { P.state.events.find((e) => e.id === 'm2').capacity = 20; },
    retypedX1: () => { P.state.events.find((e) => e.id === 'x1').type = 'medical'; },
    newClubTerms: () => { P.state.events.push(ev('n1', '2026-11-25', '09:00', '10:00', 'physio', 2, { createdByPlanner: true }), ev('n2', '2026-11-25', '11:00', '12:00', 'medical', 3, { createdByPlanner: true })); },
    newPublicTerm: () => { P.state.events.push(ev('n3', '2026-11-26', '09:00', '10:00', 'medical', 5, { origin: 'public' })); },
    manyNew: () => { P.state.events.push(ev('n4', '2026-11-27', '09:00', '19:00', 'medical', 30, { createdByPlanner: true })); },
  };
  out.order = Object.entries(states).map(([name, apply]) => {
    fresh();
    apply();
    P.render();
    const types = Object.keys(P.demandData);
    return {
      name,
      events: clone(P.state.events),
      plannedOf: Object.fromEntries(types.map((t) => [t, P.plannedOf(t)])),
      totals: clone(P.totals()),
      pendingMinutes: P.adaptivePendingMinutes(),
      snapshot: clone(P.s41Snapshot()),
      command: {
        percent: document.getElementById('oc-percent').textContent,
        total: document.getElementById('oc-total').textContent.replace(/\s+/g, ' ').trim(),
        remaining: document.getElementById('oc-remaining').textContent,
        terms: document.getElementById('oc-terms').textContent,
        slots: document.getElementById('oc-slots').textContent,
      },
      cards: [...document.querySelectorAll('#planning-cards .plan-card')].map((c) => ({
        type: c.dataset.planType,
        pct: c.style.getPropertyValue('--pct'),
        ring: c.querySelector('.plan-ring b').textContent,
        num: c.querySelector('.plan-num').textContent.replace(/\s+/g, ' ').trim(),
        remaining: c.querySelector('.plan-remaining').textContent,
        duration: c.querySelector('.plan-duration').textContent,
        bottom: c.querySelector('.plan-bottom > span').textContent,
        title: c.getAttribute('title'),
        complete: c.classList.contains('is-complete'),
        chart: [...c.querySelectorAll('.micro-chart span')].map((s) => [s.style.height, s.style.opacity]),
      })),
    };
  });
  fresh();

  /* ---- validatePlacement ---- */
  const vp = [
    { date: '2026-11-25', type: 'medical', start: '09:00', end: '10:00', quantity: 3 },
    { date: '2026-11-25', type: 'medical', start: '09:00', end: '10:00', quantity: 24 },
    { date: '2026-11-25', type: 'medical', start: '09:00', end: '10:00', quantity: 25 },
    { date: '2026-11-25', type: 'medical', start: '06:00', end: '07:00', quantity: 3 },
    { date: '2026-11-25', type: 'medical', start: '18:00', end: '19:20', quantity: 4 },
    { date: '2026-11-25', type: 'medical', start: '10:00', end: '09:00', quantity: 3 },
    { date: '2026-11-25', type: 'medical', start: '09:00', end: '10:00', quantity: 0 },
    { date: '2026-11-25', type: 'medical', start: '09:00', end: '10:00', quantity: 1.5 },
    { date: '25.11.', type: 'medical', start: '09:00', end: '10:00', quantity: 3 },
    { date: '2026-11-25', type: null, start: '09:00', end: '10:00', quantity: 3 },
    { date: '2026-11-25', type: 'nope', start: '09:00', end: '10:00', quantity: 3 },
    { date: '2026-11-18', type: 'medical', start: '09:30', end: '10:30', quantity: 3 },
    { date: '2026-11-18', type: 'medical', start: '09:30', end: '10:30', quantity: 3, skipId: 'm1' },
    { date: '2026-11-18', type: 'medical', start: '10:00', end: '10:30', quantity: 1 },
    { date: '2026-11-18', type: 'medical', start: '12:00', end: '12:40', quantity: 2 },
    { date: '2026-11-18', type: 'fitness', start: '12:00', end: '12:45', quantity: 1 },
    { date: '2026-11-18', type: 'performance', start: '12:00', end: '13:00', quantity: 51 },
    { date: '2026-11-18', type: 'performance', start: '12:00', end: '13:00', quantity: 50 },
    { date: '2026-11-18', type: 'physio', start: '12:00', end: '13:00', quantity: 8 },
    { date: '2026-11-18', type: 'physio', start: '12:00', end: '13:00', quantity: 9 },
  ];
  out.validatePlacement = vp.map((input) => ({ input, result: clone(P.validatePlacement(input)) }));

  /* ---- selectionFromPointer (pointer as board fractions) ---- */
  const rect = P.board.getBoundingClientRect();
  const sel = [];
  const startsAt = [
    { type: 'medical', day: 2, startMinutes: 540 },
    { type: 'medical', day: 6, startMinutes: 1100 },
    { type: 'physio', day: 3, startMinutes: 780 },
    { type: 'fitness', day: 0, startMinutes: 600 },
    { type: 'performance', day: 4, startMinutes: 1080 },
    { type: 'vo2', day: 1, startMinutes: 420 },
  ];
  const fractions = [[0.10, 0.05], [0.10, 0.25], [0.10, 0.50], [0.10, 0.75], [0.10, 0.99], [0.10, 1.4], [0.10, -0.2], [0.55, 0.35], [0.90, 0.60]];
  for (const s of startsAt) {
    for (const [fx, fy] of fractions) {
      P.planState.selectedType = s.type;
      P.planState.dragging = { day: s.day, startMinutes: s.startMinutes };
      const r = P.selectionFromPointer({ clientX: rect.left + fx * rect.width, clientY: rect.top + fy * rect.height });
      sel.push({ type: s.type, drag: { day: s.day, startMinutes: s.startMinutes }, fx, fy, result: clone(r) });
    }
  }
  P.planState.dragging = null; P.planState.selectedType = null;
  out.selection = { weekStart: P.iso(P.state.weekStart), cases: sel };

  /* ---- merge / addPlannedInterval ---- */
  const addCases = [
    { name: 'simple', events: [], input: { date: '2026-11-25', type: 'medical', start: '09:00', quantity: 3 } },
    { name: 'append-after', events: [ev('p1x', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20 })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'prepend-before', events: [ev('p1x', '2026-11-25', '10:00', '11:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20 })], input: { date: '2026-11-25', type: 'medical', start: '09:00', quantity: 3 } },
    { name: 'bridge', events: [ev('A', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20 }), ev('B', '2026-11-25', '11:00', '12:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20 })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'booked-blocks-merge', events: [ev('A', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20, booked: 1 })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'legacy-not-planner', events: [ev('A', '2026-11-25', '09:00', '10:00', 'medical', 3, { slotDuration: 20 })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'other-type', events: [ev('A', '2026-11-25', '09:00', '10:00', 'physio', 2, { createdByPlanner: true, slotDuration: 30 })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'other-resource', events: [ev('A', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20, roomId: 'r1' })], input: { date: '2026-11-25', type: 'medical', start: '10:00', quantity: 3 } },
    { name: 'completes-medical', events: [], input: { date: '2026-11-25', type: 'medical', start: '08:00', quantity: 24 } },
    { name: 'over-limit', events: [], input: { date: '2026-11-25', type: 'medical', start: '08:00', quantity: 25 } },
    { name: 'overlap', events: [], input: { date: '2026-11-18', type: 'physio', start: '09:30', quantity: 2 } },
    { name: 'slot-length-mismatch', events: [ev('A', '2026-11-25', '09:00', '10:30', 'medical', 3, { createdByPlanner: true, slotDuration: 20 })], input: { date: '2026-11-25', type: 'medical', start: '10:30', quantity: 3 } },
  ];
  out.addInterval = addCases.map((c) => {
    fresh();
    P.state.events.push(...clone(c.events));
    const before = clone(P.state.events);
    const toastBefore = document.getElementById('toast-layer').textContent;
    P.addPlannedInterval(c.input);
    const after = clone(P.state.events);
    const toast = document.getElementById('toast-layer').textContent.replace(/\s+/g, ' ').trim();
    return { name: c.name, before, input: c.input, after, toast: toast === toastBefore ? '' : toast, completedPanel: !document.getElementById('planner-feedback').hidden, selectedType: P.planState.selectedType };
  });
  fresh();

  /* ---- move / resize proposals ---- */
  P.state.events.push(
    ev('nm1', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20 }),
    ev('nr1', '2026-11-24', '10:00', '11:00', 'physio', 2, { createdByPlanner: true, slotDuration: 30 }),
  );
  P.render();
  const moves = [];
  for (const id of ['m1', 'a1', 'nm1', 'p1']) {
    const e = P.state.events.find((x) => x.id === id);
    for (const grab of [0, 25, 70]) {
      for (const [fx, fy] of [[0.05, 0.1], [0.3, 0.5], [0.5, 0.95], [0.95, 0.5], [0.7, 0.3], [0.5, 1.2], [1.2, 0.5], [0.15, 0.35]]) {
        P.movingEvent.active = { id, pointerId: 1, element: null, x: 0, y: 0, started: true, grabOffset: grab };
        const r = P.proposalForMove({ clientX: rect.left + fx * rect.width, clientY: rect.top + fy * rect.height });
        moves.push({ id, grab, fx, fy, result: clone(r) });
      }
    }
  }
  P.movingEvent.active = null;
  out.moves = moves;
  out.validateMove = [
    ['m1', '2026-11-18', '09:00', '11:00', true], ['m1', '2026-11-18', '09:00', '11:00', false],
    ['m1', '2026-11-19', '08:30', '10:30', true], ['m1', '2026-11-19', '06:30', '08:30', true],
    ['m1', '2026-11-19', '18:00', '19:30', true], ['m1', '2026-11-25', '09:30', '11:30', true],
    ['m1', '2026-11-19', '12:00', '13:30', true], ['m1', '2026-11-19', '14:30', '16:00', true],
  ].map(([id, date, start, end, inside]) => ({ id, date, start, end, inside, result: clone(P.validateTermMove(P.state.events.find((e) => e.id === id), date, start, end, inside)) }));

  const resizes = [];
  for (const id of ['nm1', 'nr1', 'm2', 'a1']) {
    for (const edge of ['top', 'bottom']) {
      for (const dy of [-200, -60, -20, 0, 6, 20, 35, 60, 120, 400]) {
        const orig = clone(P.state.events.find((x) => x.id === id));
        P.resizingEvent.active = { id, original: orig, element: null, edge, pointerId: 1, originY: 1000, started: true };
        const r = P.proposalForTermExpansion({ clientY: 1000 + dy });
        resizes.push({ id, edge, dy, scale: P.board.getBoundingClientRect().height / P.board.clientHeight, result: clone(r) });
      }
    }
  }
  P.resizingEvent.active = null;
  out.resizes = resizes;
  out.validateExpansion = [
    ['nm1', 'bottom', 2, '09:00', '10:40'], ['nm1', 'top', 2, '08:20', '10:00'], ['nm1', 'bottom', 0, '09:00', '10:00'],
    ['nm1', 'bottom', 25, '09:00', '17:20'], ['nm1', 'top', 25, '01:00', '10:00'], ['nm1', 'bottom', 2, '09:00', '19:30'],
    ['m1', 'bottom', 1, '08:00', '10:20'], ['m1', 'top', 1, '07:40', '10:00'], ['nr1', 'bottom', 2, '10:00', '12:00'],
    ['nr1', 'bottom', 100, '10:00', '19:00'], ['v1', 'bottom', 1, '10:30', '12:45'], ['a1', 'top', 2, '08:00', '11:00'],
  ].map(([id, edge, extra, ns, ne]) => ({ id, edge, extra, ns, ne, result: clone(P.validateTermExpansion(P.state.events.find((e) => e.id === id), edge, extra, ns, ne)) }));

  /* ---- commit move / expansion ---- */
  const slotted = ev('sl1', '2026-11-26', '09:00', '10:00', 'medical', 3, { createdByPlanner: true, slotDuration: 20, slots: [{ id: 's-a', start: '09:00', end: '09:20', date: '2026-11-26', bookingId: 'bk1' }, { id: 's-b', start: '09:20', end: '09:40' }, { id: 's-c', start: '09:40', end: '10:00' }] });
  P.state.events.push(slotted);
  P.state.events = P.state.events.filter((e) => e.id !== 'x1');
  const movedSlots = (() => {
    const old = P.state.events.find((e) => e.id === 'sl1');
    const proposal = { date: '2026-11-27', start: '11:00', end: '12:00' };
    P.confirmTermMovement('sl1', proposal);
    return { before: clone(old), proposal, after: clone(P.state.events.find((e) => e.id === 'sl1')) };
  })();
  out.commitMove = movedSlots;
  const expandBottom = (() => {
    const original = clone(P.state.events.find((e) => e.id === 'nm1'));
    const proposal = { kind: 'resize', eventId: 'nm1', date: original.date, type: 'medical', edge: 'bottom', added: 2, capacity: 5, start: '09:00', end: '10:40', startMinutes: 540, endMinutes: 640, col: 2, validation: { ok: true, reason: '' }, original };
    P.commitTermExpansion(original, proposal);
    const after = clone(P.state.events.find((e) => e.id === 'nm1'));
    // ids contain a random stamp: normalise
    for (const s of after.slots) s.id = s.id.replace(/-expand-[^-]+-[^-]+-/, '-expand-STAMP-');
    return { original, proposal, after };
  })();
  const expandTop = (() => {
    const original = clone(P.state.events.find((e) => e.id === 'nr1'));
    const proposal = { kind: 'resize', eventId: 'nr1', date: original.date, type: 'physio', edge: 'top', added: 1, capacity: 3, start: '09:30', end: '11:00', startMinutes: 570, endMinutes: 660, col: 1, validation: { ok: true, reason: '' }, original };
    P.commitTermExpansion(original, proposal);
    const after = clone(P.state.events.find((e) => e.id === 'nr1'));
    for (const s of after.slots) s.id = s.id.replace(/-expand-[^-]+-[^-]+-/, '-expand-STAMP-');
    return { original, proposal, after };
  })();
  out.commitExpand = { bottom: expandBottom, top: expandTop };
  out.smartSlotShift = (() => {
    const original = clone(P.state.events.find((e) => e.id === 'sl1'));
    const next = { ...original, date: '2026-11-28', type: 'physio', start: '08:00', capacity: 4 };
    return { original, next, result: clone(P.smartSlotShift(original, next)) };
  })();
  fresh();

  /* ---- agenda ---- */
  P.state.events.push(ev('ag1', '2026-11-25', '09:00', '10:00', 'medical', 3, { createdByPlanner: true }), ev('ag2', '2026-11-25', '11:00', '12:00', 'vo2', 4, { createdByPlanner: true, origin: 'public' }));
  P.render();
  out.agendaEvents = P.agendaEvents().map((e) => e.id);
  out.agendaPanels = [];
  for (const [mode, type, scope, selected, weekStartIso] of [
    ['activities', 'medical', 'all', '2026-11-20', '2026-11-16'],
    ['activities', 'physio', 'all', '2026-11-20', '2026-11-16'],
    ['activities', 'performance', 'all', '2026-11-20', '2026-11-16'],
    ['activities', 'bogus', 'all', '2026-11-20', '2026-11-16'],
    ['all', 'medical', 'all', '2026-11-20', '2026-11-16'],
    ['all', 'medical', 'day', '2026-11-20', '2026-11-16'],
    ['all', 'medical', 'day', '2026-11-18', '2026-11-16'],
    ['all', 'medical', 'week', '2026-11-20', '2026-11-16'],
    ['all', 'medical', 'week', '2026-11-25', '2026-11-23'],
    ['all', 'medical', 'week', '2026-11-30', '2026-11-30'],
  ]) {
    P.agendaUI.mode = mode; P.agendaUI.type = type; P.agendaUI.scope = scope;
    P.selectDay(selected);
    P.state.weekStart = P.dateOf(weekStartIso);
    P.state.selectedDate = selected;
    P.renderAppointments();
    const t = (id) => document.getElementById(id).textContent.replace(/\s+/g, ' ').trim();
    out.agendaPanels.push({
      mode, type, scope, selected, weekStart: weekStartIso,
      resolvedType: P.agendaUI.type,
      total: t('agenda-total-count'),
      chips: [...document.querySelectorAll('#agenda-activity-chips .agenda-chip')].map((c) => [c.dataset.agendaType, c.textContent, c.classList.contains('is-active')]),
      kpi: t('agenda-activity-kpi'),
      kpiFill: document.querySelector('#agenda-activity-kpi .agenda-track span').style.getPropertyValue('--fill'),
      termCount: t('agenda-activity-term-count'),
      activityRows: [...document.querySelectorAll('#agenda-activity-list .agenda-term, #agenda-activity-list .agenda-empty')].map((r) => [r.dataset.agendaOpen ?? null, r.textContent.replace(/\s+/g, ' ').trim(), r.getAttribute('title')]),
      scopeNote: t('agenda-scope-note'),
      allTotals: t('agenda-all-totals'),
      allRows: [...document.querySelectorAll('#agenda-all-list .agenda-term, #agenda-all-list .agenda-empty')].map((r) => [r.dataset.agendaOpen ?? null, r.textContent.replace(/\s+/g, ' ').trim()]),
      footer: t('agenda-footer-status'),
    });
  }
  fresh();

  /* ---- week board / headings across weeks and filters ---- */
  out.weeks = [];
  for (const [date, filter] of [['2026-11-20', 'all'], ['2026-11-20', 'medical'], ['2026-11-25', 'all'], ['2026-11-04', 'all'], ['2026-11-30', 'all'], ['2026-12-28', 'all'], ['2026-03-30', 'all'], ['2027-01-02', 'all']]) {
    P.state.filter = filter;
    P.selectDay(date);
    out.weeks.push({
      date, filter,
      weekStart: P.iso(P.state.weekStart),
      range: document.getElementById('week-range').textContent,
      number: document.getElementById('week-number').textContent,
      days: [...document.querySelectorAll('#day-headings .day-title')].map((d) => d.textContent),
      hours: [...document.querySelectorAll('#hour-column .hour-label')].map((h) => [h.textContent, h.style.top]),
      month: document.getElementById('month-title').textContent,
      events: [...document.querySelectorAll('#grid-events .schedule-event')].map((n) => ({
        cls: n.className, left: n.style.left, width: n.style.width, top: n.style.top, height: n.style.height,
        title: n.getAttribute('title'), aria: n.getAttribute('aria-label'),
        text: n.querySelector('.event-contents').textContent.replace(/\s+/g, ' ').trim(),
      })),
    });
  }
  P.state.filter = 'all';
  fresh();

  /* ---- alternate views ---- */
  out.alternates = [];
  for (const [view, date, filter] of [['day', '2026-11-20', 'all'], ['day', '2026-11-24', 'all'], ['day', '2026-11-19', 'medical'], ['month', '2026-11-20', 'all'], ['month', '2026-11-20', 'physio']]) {
    P.state.filter = filter; P.selectDay(date); P.setView(view);
    const host = document.getElementById('alternate-view');
    out.alternates.push({ view, date, filter, text: host.textContent.replace(/\s+/g, ' ').trim(), tiles: [...host.querySelectorAll('.month-tile')].map((t) => [t.dataset.day, t.textContent.replace(/\s+/g, ' ').trim(), t.style.opacity]) });
  }
  P.setView('week'); P.state.filter = 'all';
  fresh();

  /* ---- misc: summary snapshot with contact ---- */
  return out;
});

if (errors.length) console.warn('Page errors:', errors);
await browser.close();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(golden, null, 1) + '\n', 'utf8');
console.log('Wrote', outPath, `(${Object.keys(golden).length} sections)`);
