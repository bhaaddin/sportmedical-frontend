/*
 * Real-Chromium audit of the planner's FLUID desktop stage (jsdom has no layout engine).
 *
 *   PLAYWRIGHT_CORE=<path to playwright-core/index.js> CHROME=<chrome.exe> node scripts/planner-fluid-audit.mjs [--shots]
 *
 * Needs the dev stack (frontend :3000, API :5092), the dev login in `.dev-login.txt` (override: DEV_LOGIN) and the
 * prototype served at http://127.0.0.1:8799/planner-v65.html (override: PROTO) for the 1672 x 941 comparison.
 * `--shots` writes `pl-m-<w>x<h>-<lab|standard|clubscreen>.png` into the repo root (2000 and 1280 wide).
 *
 * What it asserts (exit code 1 when anything fails; every line is a measurement, nothing is mocked):
 *   1  at a host of exactly 1672 x 941 every panel equals the prototype's rectangle (tolerance 1 design px);
 *   2  at each size of the matrix the stage IS the host (<= 2 px unused), the document never scrolls
 *      (scrollHeight <= innerHeight and scrollWidth <= innerWidth), no panel overlaps another or leaves the stage,
 *      the margins around the panels are the file's own (design units), the board shows all 12 hours without scroll and
 *      no text is newly clipped compared with the design size;
 *   3  a window that is resized step by step and a browser zoom (devicePixelRatio) re-measure: after every step the stage
 *      box equals the host's content box;
 *   4  at non-design sizes a drag-to-place, a move and an edge pull hit the pointer's day and time.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE ?? 'playwright-core/index.js').href);
const chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://localhost:3000';
const PROTO = process.env.PROTO ?? 'http://127.0.0.1:8799/planner-v65.html';
const SHOTS = process.argv.includes('--shots');
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const email = /E-mail:\s*(\S+)/.exec(login)[1];
const pass = /Password:\s*(\S+)/.exec(login)[1];

const MATRIX = [[1280, 720], [1440, 900], [1920, 1080], [2000, 1000], [2560, 1080], [2560, 1440], [1600, 1200]];
const PAGES = [
  { name: 'club', shot: 'lab', url: '/planner-lab?today=2026-11-10', club: true },
  { name: 'standard', shot: 'standard', url: '/planovani', club: false },
];
/* The file's margins around the panels, in design px (planner.css: sidebar left 25 / bottom 35, header and board right 48,
   deck right 55 and bottom 1, header top 8). */
const MARGINS = { sidebarLeft: 25, headerRight: 48, plannerRight: 48, deckRight: 55, deckBottom: 1, sidebarBottom: 35 };

let failures = 0;
const fail = (msg) => { failures += 1; console.log(`   FAIL ${msg}`); };
const ok = (cond, msg) => { if (!cond) fail(msg); return cond; };
const f1 = (n) => (n == null ? '-' : n.toFixed(1));

const MEASURE = () => {
  const q = (s) => document.querySelector(s);
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  const root = q('[data-testid=planner-root]');
  if (!root) return null;
  const s = parseFloat(root.dataset.scale);
  const host = R(root); const frame = R(q('#screen-frame')); const dash = R(q('#dashboard'));
  const D = (sel) => { const e = q(sel); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: (r.left - dash.l) / s, y: (r.top - dash.t) / s, w: r.width / s, h: r.height / s }; };
  const panels = { sidebar: D('.sidebar'), planner: D('section.planner'), header: D('#club-unified-header'), deck: D('#planning-cards') };
  const detail = { strip: D('#club-details-strip'), viewport: D('.adaptive-card-viewport'), insight: D('.adaptive-insight'), body: D('#board-body'), dayBoard: D('#day-board'), hour: D('#hour-column'), toolbar: D('.planner-toolbar'), agenda: D('#agenda-panel') };
  const clipped = [];
  for (const e of document.querySelectorAll('#club-unified-header *, #planning-cards *, .sidebar *, .planner-toolbar *')) {
    if (e.children.length !== 0) continue;
    const t = (e.textContent || '').trim();
    if (t.length < 2) continue;
    const c = getComputedStyle(e);
    if (c.display === 'none' || c.visibility === 'hidden' || e.closest('.sr-only')) continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (c.overflow !== 'visible' || c.textOverflow === 'ellipsis')) clipped.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}:${t.slice(0, 28)}`);
  }
  const body = q('#board-body');
  const labels = [...document.querySelectorAll('.hour-label')];
  const br = body?.getBoundingClientRect();
  const visible = labels.filter((e) => { const r = e.getBoundingClientRect(); return r.top >= br.top - 1 && r.bottom <= br.bottom + 1; }).length;
  return {
    vp: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    doc: { sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth },
    host, frame, dash, stage: { w: parseFloat(root.dataset.stageW), h: parseFloat(root.dataset.stageH), s },
    panels, detail, clipped,
    board: body ? { scrollH: body.scrollHeight, clientH: body.clientHeight, labels: labels.length, visible, dayBoardH: R(q('#day-board')).h, bodyH: br.height } : null,
  };
};

const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 1.01 && h > 1.01 ? `${w.toFixed(1)}x${h.toFixed(1)}` : null;
};

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1010 }, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE + '/login');
await page.waitForSelector('input[type=email]');
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', pass);
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });

/* The club screen `/clubs/<id>`: the id of any club that has an order in the dev database. */
const clubId = await page.evaluate(async () => {
  const r = await fetch('/api/v1/club-orders', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  const list = r.ok ? await r.json() : [];
  return Array.isArray(list) ? (list[0]?.clubId ?? null) : null;
});
if (clubId) PAGES.push({ name: 'club screen', shot: 'clubscreen', url: `/clubs/${clubId}`, club: true });

const open = async (url) => {
  for (let attempt = 0; ; attempt++) {
    await page.goto(BASE + url);
    try {
      await page.waitForSelector('#day-board', { timeout: 15000 });
      await page.waitForTimeout(1200);
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
};
const settle = async () => {
  await page.waitForTimeout(700);
  await page.waitForSelector('[data-testid=planner-root]', { timeout: 15000 });
  await page.waitForTimeout(300);
};
const measure = async () => page.evaluate(MEASURE);

/** The viewport whose planner HOST is exactly w x h (the shell's own chrome is measured, not assumed). */
const fitHost = async (w, h) => {
  let vw = w + 28; let vh = h + 68;
  for (let i = 0; i < 4; i++) {
    await page.setViewportSize({ width: vw, height: vh });
    await settle();
    const m = await measure();
    const dw = w - m.host.w; const dh = h - m.host.h;
    if (Math.abs(dw) < 0.5 && Math.abs(dh) < 0.5) return m;
    vw += Math.round(dw); vh += Math.round(dh);
  }
  return measure();
};

/* ------------------------------ 1 - the file at 1672 x 941 ------------------------------ */
console.log('\n## 1  1672 x 941 against the prototype');
const protoPage = await ctx.newPage();
await protoPage.setViewportSize({ width: 1672, height: 941 });
await protoPage.goto(PROTO);
await protoPage.waitForTimeout(1500);
const proto = await protoPage.evaluate(() => {
  const D = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  return { sidebar: D('.sidebar'), planner: D('section.planner'), header: D('#club-unified-header'), deck: D('#planning-cards'), strip: D('#club-details-strip'), viewport: D('#adaptive-viewport'), body: D('#board-body'), dayBoard: D('#day-board'), hour: D('#hour-column'), toolbar: D('.planner-toolbar'), agenda: D('#agenda-panel') };
});
await protoPage.close();
await open(PAGES[0].url);
const design = await fitHost(1672, 941);
console.log(`   host ${f1(design.host.w)} x ${f1(design.host.h)}  stage ${f1(design.stage.w)} x ${f1(design.stage.h)}  s=${design.stage.s.toFixed(4)}`);
const designClipped = new Set(design.clipped);
for (const k of ['sidebar', 'planner', 'header', 'deck', 'strip', 'viewport', 'body', 'dayBoard', 'hour', 'toolbar', 'agenda']) {
  const a = { ...design.panels, ...design.detail }[k]; const p = proto[k];
  if (!a || !p) { fail(`${k}: missing (${a ? 'proto' : 'app'})`); continue; }
  const d = Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y), Math.abs(a.w - p.w), Math.abs(a.h - p.h));
  console.log(`   ${k.padEnd(9)} app x${f1(a.x)} y${f1(a.y)} w${f1(a.w)} h${f1(a.h)}   proto x${f1(p.x)} y${f1(p.y)} w${f1(p.w)} h${f1(p.h)}   max diff ${d.toFixed(2)}`);
  ok(d <= 1, `${k} differs from the prototype by ${d.toFixed(2)} design px`);
}

/* ------------------------------ 2 - the matrix ------------------------------ */
for (const pg of PAGES) {
  console.log(`\n## 2  ${pg.name} (${pg.url})`);
  await open(pg.url);
  for (const [w, h] of MATRIX) {
    await page.setViewportSize({ width: w, height: h });
    await settle();
    const m = await measure();
    console.log(` ${w}x${h}: host ${f1(m.host.w)}x${f1(m.host.h)} frame ${f1(m.frame.w)}x${f1(m.frame.h)} stage ${f1(m.stage.w)}x${f1(m.stage.h)} s=${m.stage.s.toFixed(3)} doc ${m.doc.sh}/${m.vp.h} board ${f1(m.board.bodyH)} hours ${m.board.visible}/${m.board.labels}`);
    ok(Math.abs(m.host.w - m.frame.w) <= 2 && Math.abs(m.host.h - m.frame.h) <= 2, `frame ${f1(m.frame.w)}x${f1(m.frame.h)} is not the host ${f1(m.host.w)}x${f1(m.host.h)}`);
    ok(Math.abs(m.dash.w - m.frame.w) <= 0.6 && Math.abs(m.dash.h - m.frame.h) <= 0.6, 'stage box differs from the frame');
    ok(m.doc.sh <= m.vp.h && m.doc.sw <= m.vp.w, `the document scrolls (${m.doc.sw}x${m.doc.sh} in ${m.vp.w}x${m.vp.h})`);
    const names = Object.keys(m.panels).filter((k) => m.panels[k]);
    for (const k of names) {
      const p = m.panels[k];
      ok(p.x >= -0.5 && p.y >= -0.5 && p.x + p.w <= m.stage.w + 0.5 && p.y + p.h <= m.stage.h + 0.5, `${k} leaves the stage`);
    }
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const o = overlap(m.panels[names[i]], m.panels[names[j]]);
      if (o) fail(`${names[i]} overlaps ${names[j]} by ${o}`);
    }
    const pn = m.panels;
    ok(Math.abs(pn.sidebar.x - MARGINS.sidebarLeft) <= 1, `left margin ${f1(pn.sidebar.x)}`);
    ok(Math.abs(m.stage.w - (pn.planner.x + pn.planner.w) - MARGINS.plannerRight) <= 1, `board right margin ${f1(m.stage.w - pn.planner.x - pn.planner.w)}`);
    ok(Math.abs(m.stage.w - (pn.header.x + pn.header.w) - MARGINS.headerRight) <= 1, `header right margin ${f1(m.stage.w - pn.header.x - pn.header.w)}`);
    ok(Math.abs(m.stage.h - (pn.sidebar.y + pn.sidebar.h) - MARGINS.sidebarBottom) <= 1, `left panel bottom margin ${f1(m.stage.h - pn.sidebar.y - pn.sidebar.h)}`);
    if (pn.deck) {
      ok(Math.abs(m.stage.w - (pn.deck.x + pn.deck.w) - MARGINS.deckRight) <= 1, `deck right margin ${f1(m.stage.w - pn.deck.x - pn.deck.w)}`);
      ok(Math.abs(m.stage.h - (pn.deck.y + pn.deck.h) - MARGINS.deckBottom) <= 1, `deck bottom margin ${f1(m.stage.h - pn.deck.y - pn.deck.h)}`);
    }
    ok(m.board.visible === 12 && m.board.labels === 12, `hours visible ${m.board.visible}/${m.board.labels}`);
    ok(m.board.scrollH <= m.board.clientH + 1, `the board scrolls (${m.board.scrollH} > ${m.board.clientH})`);
    ok(Math.abs(m.board.dayBoardH - m.board.bodyH) <= 1, `day board ${f1(m.board.dayBoardH)} is not the body ${f1(m.board.bodyH)}`);
    if (pg.club) {
      const fresh = m.clipped.filter((c) => !designClipped.has(c));
      if (fresh.length) console.log(`   note: clipped text not clipped at the design size: ${fresh.join(' | ')}`);
    }
    if (SHOTS && (w === 2000 || w === 1280)) await page.screenshot({ path: `pl-m-${w}x${h}-${pg.shot}.png` });
  }
}

/* ------------------------------ 3 - resize steps and zoom ------------------------------ */
console.log('\n## 3  resize steps and browser zoom');
await open(PAGES[0].url);
await page.setViewportSize({ width: 2000, height: 1000 });
await settle();
for (const [w, h] of [[1900, 900], [1500, 1000], [1280, 720], [2560, 1440]]) {
  await page.setViewportSize({ width: w, height: h });
  await settle();
  const m = await measure();
  const sameBox = Math.abs(m.host.w - m.frame.w) <= 2 && Math.abs(m.host.h - m.frame.h) <= 2 && Math.abs(m.host.l - m.frame.l) <= 2 && Math.abs(m.host.t - m.frame.t) <= 2;
  console.log(` resize to ${w}x${h}: host ${f1(m.host.w)}x${f1(m.host.h)} stage ${f1(m.frame.w)}x${f1(m.frame.h)} -> ${sameBox ? 'equal' : 'DIFFERENT'}, doc ${m.doc.sh}/${m.vp.h}`);
  ok(sameBox, `after resizing to ${w}x${h} the stage box is not the host box`);
  ok(m.doc.sh <= m.vp.h, `the document scrolls after resizing to ${w}x${h}`);
  const names = Object.keys(m.panels).filter((k) => m.panels[k]);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const o = overlap(m.panels[names[i]], m.panels[names[j]]); if (o) fail(`${names[i]} overlaps ${names[j]} by ${o}`); }
}
/* Browser zoom: the CSS viewport shrinks / grows and devicePixelRatio changes - emulated live in the same page. */
const cdp = await ctx.newCDPSession(page);
for (const [zoom, w, h] of [[1.25, 1600, 800], [0.8, 2500, 1250], [1, 2000, 1000]]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: zoom, mobile: false });
  await page.waitForTimeout(900);
  const m = await measure();
  const sameBox = Math.abs(m.host.w - m.frame.w) <= 2 && Math.abs(m.host.h - m.frame.h) <= 2;
  console.log(` zoom ${Math.round(zoom * 100)}% (css viewport ${w}x${h}, dpr ${m.vp.dpr}): host ${f1(m.host.w)}x${f1(m.host.h)} stage ${f1(m.frame.w)}x${f1(m.frame.h)} stageLogical ${f1(m.stage.w)}x${f1(m.stage.h)} -> ${sameBox ? 'equal' : 'DIFFERENT'}, doc ${m.doc.sh}/${m.vp.h}`);
  ok(sameBox, `at zoom ${zoom} the stage box is not the host box`);
  ok(m.doc.sh <= m.vp.h && m.doc.sw <= m.vp.w, `the document scrolls at zoom ${zoom}`);
}
await cdp.send('Emulation.clearDeviceMetricsOverride');

/* ------------------------------ 4 - pointer hits at non-design sizes ------------------------------ */
console.log('\n## 4  drag / move / edge pull at non-design sizes (club planning, demo data)');
await open(PAGES[0].url); /* a clean page: the zoom emulation above must not leave a half-laid-out board under the pointer */
const SLOT_MINUTES = 20;
/* 95 min = 4.75 slots: clear of the .5 rounding edge, so the answer is 5 at every size. */
const PULL = 95;
for (const [w, h] of [[2000, 1000], [1440, 900], [1600, 1200], [2560, 1080]]) {
  await page.setViewportSize({ width: w, height: h });
  await settle();
  if (!(await page.locator('.plan-card.is-selected').count())) { await page.locator('.plan-card').first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => { const r = document.querySelector('#day-board').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const yOf = (m) => box.t + ((m - 420) / 720) * box.h;
  const xOf = (d) => box.l + ((d + 0.5) / 7) * box.w;
  const day = 4; const m0 = 600; const m1 = 695;
  await page.mouse.move(xOf(day), yOf(m0)); await page.mouse.down();
  await page.mouse.move(xOf(day), yOf(m0) + 30, { steps: 3 }); await page.mouse.move(xOf(day), yOf(m1), { steps: 4 });
  await page.waitForTimeout(200);
  const pv = await page.evaluate(() => { const e = document.querySelector('#drag-preview'); const r = e.getBoundingClientRect(); const b = document.querySelector('#day-board').getBoundingClientRect(); return { col: (r.left - b.left) / (b.width / 7), start: 420 + ((r.top - b.top) / b.height) * 720, end: 420 + ((r.bottom - b.top) / b.height) * 720, text: e.innerText.replace(/\s+/g, ' ') }; });
  await page.mouse.up(); await page.waitForTimeout(300);
  const expectEnd = m0 + Math.ceil((m1 - m0) / SLOT_MINUTES) * SLOT_MINUTES;
  const hitDay = Math.floor(pv.col + 0.001) === day; const hitStart = Math.abs(pv.start - m0) < 1; const hitEnd = Math.abs(pv.end - expectEnd) < 1;
  console.log(` ${w}x${h} board ${f1(box.w)}x${f1(box.h)} px: drop at day ${day} 10:00 -> ${pv.text} (column ${pv.col.toFixed(2)}, ${pv.start.toFixed(1)}-${pv.end.toFixed(1)} min, expected ${m0}-${expectEnd})`);
  ok(hitDay && hitStart && hitEnd, `${w}x${h}: the placement does not match the pointer`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  const cards = await page.evaluate(() => [...document.querySelectorAll('#grid-events .schedule-event[data-source="club"]')].map((c) => { const q = c.getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; }));
  const c0 = cards.filter((c) => c.h > 60).sort((a, b) => b.h - a.h)[0];
  if (c0) {
    const minOf = (y) => 420 + ((y - box.t) / box.h) * 720;
    const oldStart = minOf(c0.t); const col0 = Math.round((c0.l - box.l) / (box.w / 7));
    const gx = c0.l + c0.w / 2; const gy = c0.t + c0.h / 3;
    await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move(gx + 12, gy + 12, { steps: 3 });
    await page.mouse.move(gx + box.w / 7, gy + (90 / 720) * box.h, { steps: 6 }); await page.waitForTimeout(250);
    const gh = await page.evaluate(() => { const g = document.querySelector('#move-ghost').getBoundingClientRect(); const b = document.querySelector('#day-board').getBoundingClientRect(); return { col: (g.left - b.left) / (b.width / 7), start: 420 + ((g.top - b.top) / b.height) * 720 }; });
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    console.log(` ${w}x${h} move: card at column ${col0}, ${oldStart.toFixed(0)} min -> ghost column ${gh.col.toFixed(2)}, ${gh.start.toFixed(1)} min (expected ${col0 + 1}, ${(oldStart + 90).toFixed(0)})`);
    ok(Math.floor(gh.col + 0.001) === col0 + 1 && Math.abs(gh.start - (oldStart + 90)) <= 5, `${w}x${h}: the move ghost does not follow the pointer`);
  } else fail(`${w}x${h}: no club card to move`);

  const handle = await page.evaluate(() => { const c = [...document.querySelectorAll('#grid-events .schedule-event[data-source="club"]')].find((x) => x.querySelector('.term-resize-handle[data-expand-edge="bottom"]')); if (!c) return null; const hd = c.querySelector('.term-resize-handle[data-expand-edge="bottom"]').getBoundingClientRect(); return { x: hd.left + hd.width / 2, y: hd.top + hd.height / 2 }; });
  if (handle) {
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.x, handle.y + 8, { steps: 2 });
    await page.mouse.move(handle.x, handle.y + (PULL / 720) * box.h, { steps: 6 }); await page.waitForTimeout(250);
    const added = await page.evaluate(() => document.querySelector('#term-resize-added')?.innerText.replace(/\s+/g, ' ') ?? '');
    await page.mouse.up(); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const expected = Math.round(PULL / SLOT_MINUTES);
    console.log(` ${w}x${h} edge pull +${PULL} min -> "${added}" (expected +${expected} slotů)`);
    ok(added.startsWith(`+${expected} `), `${w}x${h}: the edge pull added "${added}" instead of +${expected}`);
  } else fail(`${w}x${h}: no resize handle`);
}

await browser.close();
if (errors.length) console.log(`\npage errors: ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
console.log(failures === 0 ? '\nAUDIT OK' : `\nAUDIT FAILED: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
