/*
 * Responsive / fluid audit of every STAFF page in a real Chromium (jsdom has no layout engine).
 *
 *   PLAYWRIGHT_CORE=<path to playwright-core/index.js> CHROME=<chrome.exe> node scripts/responsive-audit.mjs
 *   env: OUT=<result.json>  VP=<comma list of WxH or WxH@zoom, default: the full matrix>  ONLY=<substring of a route>
 *        WORKERS=<parallel contexts, default 5>  BASE=<http://localhost:3000>  DEV_LOGIN=<file with E-mail/Password>
 *
 * Needs the dev stack (frontend :3000, API :5092). For every route x viewport it measures (not eyeballs):
 *   overflow   documentElement.scrollWidth > clientWidth, and elements sticking out of the viewport
 *   gaps       the painted extent of #main-content against the room next to the shell (left / right gap, used %)
 *   touch      interactive controls smaller than 44 px (phone + tablet only, split main / shell)
 *   covered    the last painted row hidden behind a fixed bottom bar after scrolling to the end
 *   clipped    text boxes that cut their text (overflow hidden without an ellipsis)
 *   innerScroll  boxes that scroll sideways inside the page (phone: a table that needs a card layout)
 *   intrude    painted content to the left of the main area (under the rail / sidebar)
 *   overlap    text boxes that sit on top of one another
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE ?? 'playwright-core/index.js').href);
const chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.env.OUT ?? 'responsive-audit.json';
const login = readFileSync(process.env.DEV_LOGIN ?? 'C:/Users/Matko/SportMedical.Booking/.dev-login.txt', 'utf8');
const email = /E-mail:\s*(\S+)/.exec(login)[1];
const pass = /Password:\s*(\S+)/.exec(login)[1];

const FULL = [
  '360x640', '390x844', '430x932',
  '768x1024', '820x1180', '834x1112', '1024x1366',
  '1024x768', '1180x820', '1366x1024',
  '1280x720', '1366x768', '1440x900', '1536x864', '1920x1080', '2560x1440', '3440x1440',
  '1440x900@0.8', '1440x900@1.25', '1920x1080@0.8', '1920x1080@1.25',
];
const VPS = (process.env.VP ? process.env.VP.split(',') : FULL).map((s) => {
  const [size, zoom] = s.split('@');
  const [w, h] = size.split('x').map(Number);
  const z = zoom ? Number(zoom) : 1;
  return { label: s, w: Math.round(w / z), h: Math.round(h / z), z };
});

const ROUTES = [
  '/prehled', '/patients', '/patients/register', '/diagnostics/new', '/intake-review',
  '/billing', '/cashier', '/accounting-export', '/nastaveni/cenik', '/availability',
  '/dnes', '/prehled-sluzeb', '/vyhrazeni', '/blokovany-cas',
  '/calendars', '/activities', '/working-hours', '/exceptions', '/nepritomnosti', '/svatky',
  '/nastaveni/sluzby', '/staff-management', '/admin', '/audit-log', '/system-health',
  '/hodnoceni-pacientu', '/dotaznik-nastaveni', '/pravidla-dokumentu', '/dokumenty-sablony',
  '/settings', '/settings/provoz', '/settings/sluzby-a-ceny', '/settings/komunikace', '/settings/dokumenty',
  '/settings/vzhled-webu', '/settings/system',
  '/nastaveni/vzhled-kalendare', '/nastaveni/udaje-pacienta', '/nastaveni/slevy', '/nastaveni/barvy-sluzeb',
  '/nastaveni/rychla-registrace', '/nastaveni/firma-a-faktury', '/nastaveni/media-a-texty',
  '/nastaveni/uloziste-medii', '/nastaveni/kluby', '/nastaveni/integrace', '/nastaveni/historie-zmen',
  '/nastaveni/skupinove-slevy', '/nastaveni/pripominky', '/nastaveni/souhlasy', '/nastaveni/sablony-emailu',
  '/nastaveni/zabezpeceni', '/nepoznana-stranka-404',
];
const PATIENT_TABS = ['', '/dokumenty', '/terminy', '/historie', '/vysledky', '/faktury', '/edit'];

/* runs inside the page */
function measureInPage() {
  const W = document.documentElement.clientWidth;
  const H = window.innerHeight;
  const res = { W, H };
  const sig = (el) => {
    const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter((c) => c && !/^css-/.test(c)).slice(0, 2).join('.');
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
  };
  const inter = (a, b) => {
    const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), bt = Math.min(a.bottom, b.bottom);
    return { left: l, right: r, top: t, bottom: bt, width: r - l, height: bt - t };
  };
  const main = document.querySelector('#main-content');
  res.hasMain = !!main;
  res.docOverflow = Math.max(0, document.documentElement.scrollWidth - W, document.body.scrollWidth - W);
  res.h1 = (document.querySelector('h1, h2')?.textContent || '').trim().slice(0, 50);
  res.path = location.pathname;
  res.notFound = /nenalezen|404/i.test(main?.textContent?.slice(0, 400) || '') && (main?.textContent?.length || 0) < 400;
  res.docHeight = document.documentElement.scrollHeight;
  const region = document.querySelector('#fit-region');
  if (region) { res.regionScroll = region.scrollHeight - region.clientHeight; res.regionOverflowX = region.scrollWidth - region.clientWidth; }
  if (!main) return res;

  const mr = main.getBoundingClientRect();
  const mcs = getComputedStyle(main);
  const availLeft = mr.left + parseFloat(mcs.paddingLeft);
  const availRight = mr.right - parseFloat(mcs.paddingRight);
  res.avail = Math.round(availRight - availLeft);
  res.mainLeft = Math.round(mr.left);

  let minL = Infinity, maxR = -Infinity, maxB = -Infinity;
  const overflowEls = [], innerScroll = [], clipped = [], ellipsis = [];
  const textBoxes = [];
  const visible = (cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  const paintedTags = new Set(['TABLE', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'CANVAS', 'VIDEO', 'BUTTON']);
  const note = (rect) => {
    if (rect.width <= 0.5 || rect.height <= 0.5) return;
    if (rect.left < minL) minL = rect.left;
    if (rect.right > maxR) maxR = rect.right;
    if (rect.bottom > maxB) maxB = rect.bottom;
  };
  const walk = (el, clip, depth, sticky = false) => {
    const cs = getComputedStyle(el);
    if (!visible(cs) || cs.position === 'fixed') return;
    if (cs.position === 'sticky') sticky = true;
    /* a visually-hidden helper (1 px, absolutely placed) is not a painted box */
    if (cs.position === 'absolute' && el.getBoundingClientRect().width <= 2 && el.getBoundingClientRect().height <= 2) return;
    if (el.matches('label.MuiFormLabel-root, label.MuiInputLabel-root')) sticky = true;
    const rect = el.getBoundingClientRect();
    let c = clip;
    const clipsX = cs.overflowX !== 'visible';
    const clipsY = cs.overflowY !== 'visible';
    if (clipsX || clipsY) {
      c = {
        left: clipsX ? Math.max(clip.left, rect.left) : clip.left,
        right: clipsX ? Math.min(clip.right, rect.right) : clip.right,
        top: clipsY ? Math.max(clip.top, rect.top) : clip.top,
        bottom: clipsY ? Math.min(clip.bottom, rect.bottom) : clip.bottom,
      };
    }
    const vis = inter(rect, c);
    /* sticking out of the viewport (after clipping) */
    if (vis.width > 0 && vis.height > 0 && (vis.right > W + 1 || vis.left < -1) && el.tagName !== 'svg') {
      overflowEls.push({ el, sig: sig(el), left: Math.round(vis.left), right: Math.round(vis.right), w: Math.round(rect.width) });
    }
    if (clipsX && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      if (/auto|scroll/.test(cs.overflowX)) {
        innerScroll.push({ sig: sig(el), sw: el.scrollWidth, cw: el.clientWidth, table: !!el.querySelector('table') || el.tagName === 'TABLE' });
      } else if (el.textContent.trim() && cs.textOverflow !== 'ellipsis' && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) {
        clipped.push({ sig: sig(el), sw: el.scrollWidth, cw: el.clientWidth });
      } else if (cs.textOverflow === 'ellipsis' && el.textContent.trim()) {
        ellipsis.push({ sig: sig(el), sw: el.scrollWidth, cw: el.clientWidth });
      }
    }
    const bg = cs.backgroundColor;
    const alpha = bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : bg === 'transparent' ? 0 : 1;
    const bordered = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs[`border${s}Color`]));
    const painted = paintedTags.has(el.tagName) || alpha > 0.02 || bordered || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none';
    if (painted && vis.width > 0 && vis.height > 0 && el !== main) note(vis);
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const r = document.createRange();
        r.selectNodeContents(n);
        const tr = r.getBoundingClientRect();
        const tv = inter(tr, c);
        if (tv.width > 0 && tv.height > 0) {
          note(tv);
          if (!sticky && textBoxes.length < 700) textBoxes.push({ el, r: tv });
        }
      }
    }
    if (el.tagName === 'svg' || el.tagName === 'SVG') return;
    for (const ch of el.children) walk(ch, c, depth + 1, sticky);
  };
  const big = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };
  for (const ch of main.children) walk(ch, big, 0);

  res.minLeft = Number.isFinite(minL) ? Math.round(minL) : null;
  res.maxRight = Number.isFinite(maxR) ? Math.round(maxR) : null;
  if (res.minLeft !== null) {
    res.gapL = Math.round(res.minLeft - availLeft);
    res.gapR = Math.round(availRight - res.maxRight);
    res.used = +((res.maxRight - res.minLeft) / Math.max(1, availRight - availLeft)).toFixed(3);
    res.intrude = Math.round(mr.left - res.minLeft) > 1 ? Math.round(mr.left - res.minLeft) : 0;
  }
  /* keep root causes only: an element whose parent also sticks out is a consequence */
  const set = new Set(overflowEls.map((o) => o.el));
  res.overflowEls = overflowEls.filter((o) => !set.has(o.el.parentElement)).slice(0, 8).map(({ sig: s, left, right, w }) => ({ sig: s, left, right, w }));
  res.innerScroll = innerScroll.slice(0, 8);
  res.clipped = clipped.slice(0, 8);
  res.ellipsisCount = ellipsis.length;

  /* overlapping text */
  const overlaps = [];
  for (let i = 0; i < textBoxes.length && overlaps.length < 6; i++) {
    for (let j = i + 1; j < textBoxes.length; j++) {
      const a = textBoxes[i], b = textBoxes[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const o = inter(a.r, b.r);
      if (o.width <= 2 || o.height <= 2) continue;
      const area = o.width * o.height;
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (area / small > 0.3) { overlaps.push(`${sig(a.el)} x ${sig(b.el)}`); break; }
    }
  }
  res.overlap = overlaps;

  /* touch targets */
  if (W < 1280) {
    const sel = 'button, a[href], [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=radio], input:not([type=hidden]), select, textarea, summary';
    const seen = new Set();
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('.skip-link') || el.matches('.skip-link')) continue;
      /* the hidden native control behind a MUI Select is no target */
      if (el.matches('.MuiSelect-nativeInput') || el.getAttribute('aria-hidden') === 'true' || el.tabIndex === -1 && el.tagName === 'INPUT' && !el.closest('label')) continue;
      let t = el;
      if (el.tagName === 'INPUT' && /checkbox|radio|color/.test(el.type)) t = el.closest('label') || el.parentElement || el;
      const cs = getComputedStyle(t);
      if (!visible(getComputedStyle(el)) && !(el.tagName === 'INPUT' && el.style.opacity !== undefined)) continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      /* an inline link inside a sentence is exempt */
      if (el.tagName === 'A' && cs.display === 'inline' && Array.from(el.parentElement?.childNodes || []).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      /* hidden by an ancestor's clip or a collapsed region */
      let r = t.getBoundingClientRect();
      let p = t.parentElement, hidden = false;
      while (p && p !== document.body) {
        const pc = getComputedStyle(p);
        if (pc.display === 'none' || pc.visibility === 'hidden') { hidden = true; break; }
        if (pc.overflowX !== 'visible' || pc.overflowY !== 'visible') {
          const v = inter(r, p.getBoundingClientRect());
          if (v.width <= 0 || v.height <= 0) { hidden = true; break; }
        }
        p = p.parentElement;
      }
      if (hidden || r.width === 0 || r.height === 0) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      if (Math.min(r.width, r.height) < 43.5) {
        const anc = []; for (let a = el.parentElement; a && anc.length < 3; a = a.parentElement) { const c = (typeof a.className === 'string' ? a.className : '').split(/s+/).find((x) => x && !/^css-|^Mui(Box|Stack)-root/.test(x)); anc.push(a.tagName.toLowerCase() + (c ? '.' + c : '')); }
        bad.push({ sig: sig(el) + (el.getAttribute('href') ? ' href=' + el.getAttribute('href').slice(0, 24) : '') + ' <' + anc.join('<'), w: Math.round(r.width), h: Math.round(r.height), shell: !main.contains(el) });
      }
    }
    res.touchMain = bad.filter((b) => !b.shell).length;
    res.touchShell = bad.filter((b) => b.shell).length;
    res.touchSamples = bad.filter((b) => !b.shell).slice(0, 10);
    res.touchShellSamples = bad.filter((b) => b.shell).slice(0, 4);
  }
  return res;
}

/* runs after scrolling to the end: is the last row behind a fixed bar? */
function coveredInPage() {
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  const main = document.querySelector('#main-content');
  if (!main) return null;
  const bars = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && cs.visibility !== 'hidden') {
      const r = el.getBoundingClientRect();
      if (r.width > W * 0.4 && r.height > 20 && r.height < H * 0.4 && r.bottom >= H - 2 && r.top > H * 0.5) bars.push({ el, top: r.top, sig: el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.split(' ').find((c) => !c.startsWith('css-')) || '' : '') });
    }
  }
  if (!bars.length) return { bars: 0 };
  const barTop = Math.min(...bars.map((b) => b.top));
  let maxB = -Infinity;
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.opacity === '0') return;
    const r = el.getBoundingClientRect();
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n);
        const b = rg.getBoundingClientRect();
        if (b.height > 0 && b.width > 0 && b.top < H) maxB = Math.max(maxB, b.bottom);
      }
    }
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'TABLE'].includes(el.tagName) && r.height > 0 && r.top < H) maxB = Math.max(maxB, r.bottom);
    if (cs.overflowY !== 'visible' && r.height > 0) { /* inner scroller: take its box */ if (r.top < H) maxB = Math.max(maxB, Math.min(r.bottom, H)); }
    if (el.tagName === 'svg') return;
    for (const c of el.children) walk(c);
  };
  for (const c of main.children) walk(c);
  return { bars: bars.length, barTop: Math.round(barTop), lastBottom: Math.round(maxB), covered: maxB > barTop + 1, barSig: bars[0].sig };
}

async function settle(page) {
  try { await page.waitForSelector('#main-content', { timeout: 15000 }); } catch { /* a page without a shell (login) */ }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  /* a page that says it is loading is not measured yet */
  await page.waitForFunction(() => !/Načítám|Načítání/.test(document.querySelector('#main-content')?.innerText ?? ''), null, { timeout: 12000 }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('#main-content .MuiCircularProgress-root, #main-content .MuiSkeleton-root, #main-content [role=progressbar]'));
    if (!busy) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
const STATE = process.env.STATE_FILE ?? 'responsive-audit.state.json';
if (!existsSync(STATE) || process.env.RELOGIN) {
  const c0 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'cs-CZ' });
  const p0 = await c0.newPage();
  await p0.goto(BASE + '/login');
  await p0.waitForSelector('input[type=email]');
  await p0.fill('input[type=email]', email);
  await p0.fill('input[type=password]', pass);
  await p0.keyboard.press('Enter');
  await p0.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p0.waitForTimeout(1500);
  await c0.storageState({ path: STATE });
  await c0.close();
}
const api0 = await browser.newContext({ storageState: STATE });
const p0 = await api0.newPage();
await p0.goto(BASE + '/prehled');
const patientId = await p0.evaluate(async () => {
  const token = localStorage.getItem('token');
  for (const url of ['/api/patients?pageSize=1']) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) continue;
      const j = await r.json();
      const d = j.data ?? j; const list = Array.isArray(d) ? d : d.items ?? d.results ?? [];
      if (list[0]?.id) return list[0].id;
    } catch { /* next */ }
  }
  return null;
});
await api0.close();
console.log('patient id:', patientId);
const routes = [...ROUTES];
if (patientId) for (const t of PATIENT_TABS) routes.push(`/patients/${patientId}${t}`);
if (process.env.EXTRA) routes.push(...process.env.EXTRA.split(','));
const todo = routes.filter((r) => !process.env.ONLY || process.env.ONLY.split(',').some((o) => r.includes(o)));

const results = [];
const queue = [...VPS];
async function worker(id) {
  while (queue.length) {
    const vp = queue.shift();
    const ctx = await browser.newContext({
      storageState: STATE, viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.z, hasTouch: vp.w < 1400,
      isMobile: false, locale: 'cs-CZ', timezoneId: 'Europe/Prague',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    for (const route of todo) {
      let r = { route, vp: vp.label, w: vp.w, h: vp.h };
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          errors.length = 0;
          await page.goto(BASE + route, { waitUntil: 'load', timeout: 45000 });
          await settle(page);
          const hasErr = await page.evaluate(() => /Failed to fetch dynamically|\[plugin:vite/.test(document.body.innerText.slice(0, 600)));
          if (!hasErr) break;
          await page.waitForTimeout(1500);
        }
        Object.assign(r, await page.evaluate(measureInPage));
        await page.evaluate(() => { const r = document.querySelector('#fit-region'); if (r) r.scrollTo(0, r.scrollHeight); window.scrollTo(0, document.documentElement.scrollHeight); });
        await page.waitForTimeout(120);
        r.covered = await page.evaluate(coveredInPage);
        r.errors = errors.slice(0, 2);
      } catch (e) {
        r.fatal = String(e).slice(0, 160);
      }
      results.push(r);
    }
    await ctx.close();
    console.log(`[w${id}] done ${vp.label}  (${results.length} rows)`);
    writeFileSync(OUT, JSON.stringify(results));
  }
}
await Promise.all(Array.from({ length: Number(process.env.WORKERS ?? 5) }, (_, i) => worker(i)));
writeFileSync(OUT, JSON.stringify(results));
await browser.close();
console.log('written', OUT, results.length);
