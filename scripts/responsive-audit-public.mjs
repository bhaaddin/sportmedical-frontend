/*
 * Responsive / fluid audit of every PUBLIC page, measured in a real Chromium (jsdom has no layout engine).
 *
 *   PLAYWRIGHT_CORE=<playwright-core/index.js> CHROME=<chrome.exe> LINKS=<links.json> OUT=<result.json> \
 *     node scripts/responsive-audit-public.mjs [--only=objednat,cenik] [--vp=360x640,1440x900] [--kind=app|marketing]
 *
 * Needs the dev frontend (:3000) and API (:5092). LINKS is a JSON file with real tokens minted from the dev DB:
 *   { portalToken, clubForm, clubPortal, clubReg }  (the last three are site-relative paths).
 * Pages that cannot get a real token (manage booking, feedback, completion link) are mocked with page.route and are
 * marked `mock` in the result.
 *
 * Per page x viewport it measures: horizontal overflow, page scroll (app-like pages must not scroll the document),
 * content extents (dead side space / gutter symmetry), touch targets, clipped and overlapping text, fixed bars covering
 * content, images without intrinsic size, layout shift, form fields narrower than their labels, dialogs taller than
 * the viewport. `fail` lists the rule names a record breaks.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE ?? 'playwright-core/index.js').href);
const chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://localhost:3000';
const LINKS = process.env.LINKS ? JSON.parse(readFileSync(process.env.LINKS, 'utf8')) : {};
const OUT = process.env.OUT ?? 'responsive-audit-public.json';
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/* ── viewport matrix ── */
const V = (w, h, cls, extra = {}) => ({ w, h, cls, touch: cls !== 'desktop' && cls !== 'ultrawide' && !cls.startsWith('zoom'), ...extra });
const VIEWPORTS = [
  V(360, 640, 'phone'), V(390, 844, 'phone'), V(430, 932, 'phone'),
  V(768, 1024, 'tablet-portrait'), V(820, 1180, 'tablet-portrait'), V(834, 1112, 'tablet-portrait'), V(1024, 1366, 'tablet-portrait'),
  V(1024, 768, 'tablet-landscape'), V(1180, 820, 'tablet-landscape'), V(1366, 1024, 'tablet-landscape'),
  V(1280, 720, 'desktop'), V(1366, 768, 'desktop'), V(1440, 900, 'desktop'), V(1536, 864, 'desktop'), V(1920, 1080, 'desktop'), V(2560, 1440, 'desktop'),
  V(3440, 1440, 'ultrawide'),
  // browser zoom = the layout viewport the page sees (screen / zoom)
  V(1708, 960, 'zoom80', { label: '1366x768@80%' }), V(1093, 614, 'zoom125', { label: '1366x768@125%' }),
  V(2400, 1350, 'zoom80', { label: '1920x1080@80%' }), V(1536, 864, 'zoom125', { label: '1920x1080@125%' }),
];

/* ── pages ── */
const MARKETING = ['/', '/sluzby', '/prohlidky', '/diagnostika', '/inbody', '/cenik', '/dokumenty', '/kontakt', '/o-nas', '/kluby', '/faq',
  '/obchodni-podminky', '/ochrana-osobnich-udaju', '/storno-a-reklamace', '/vybaveni', '/partneri',
  '/diagnostika/zakladni', '/diagnostika/komplexni', '/diagnostika/vo2max', '/diagnostika/kompenzacni-plan'];

const PAGES = [
  ...MARKETING.map((p) => ({ id: p === '/' ? 'landing' : p.slice(1).replace('/', '-'), path: p, kind: 'marketing' })),
  { id: 'objednat', path: '/objednat', kind: 'app' },
  { id: 'dotaznik', path: '/dotaznik', kind: 'app' },
  { id: 'portal-prihlaseni', path: '/portal/prihlaseni', kind: 'app' },
  { id: 'portal', path: () => `/portal/${LINKS.portalToken}`, kind: 'app' },
  { id: 'klub-registrace', path: () => LINKS.clubReg, kind: 'app' },
  { id: 'klub-objednavka-formular', path: () => LINKS.clubForm, kind: 'app' },
  { id: 'klub-portal', path: () => LINKS.clubPortal, kind: 'app' },
  { id: 'hodnoceni', path: '/hodnoceni/audit-token-0000000000000000000000000000', kind: 'app' },
  { id: 'rezervace-mrtvy-odkaz', path: '/rezervace/audit-token-0000000000000000000000000000', kind: 'app' },
  { id: 'rezervace-mock', path: '/rezervace/audit-mock-token', kind: 'app', mock: 'manage' },
  { id: 'dokonceni-mrtvy-odkaz', path: '/dokonceni/audit-token-0000000000000000000000000000', kind: 'app' },
  // States reached by a click (a step that finds nothing to click is skipped: the mobile menu does not exist on a wide screen).
  { id: 'objednat-termin', path: '/objednat', kind: 'app', steps: ['click?button[aria-label^="Objednat:"]'] },
  { id: 'rezervace-zrusit', path: '/rezervace/audit-mock-token', kind: 'app', mock: 'manage', steps: ['click?text=Zrušit termín'] },
  { id: 'rezervace-presunout', path: '/rezervace/audit-mock-token', kind: 'app', mock: 'manage', steps: ['click?text=Přesunout na jiný čas'] },
  { id: 'menu-telefon', path: '/', kind: 'marketing', steps: ['click?button[aria-label="Otevřít menu"]'] },
  { id: 'menu-aplikace', path: '/objednat', kind: 'app', steps: ['click?button[aria-label="Otevřít menu"]'] },
];

/* ── in-page measurement ── */
function measure({ vw, vh }) {
  const visible = (el) => {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /* A text rect as the user sees it: cut by every clipping ancestor; null when nothing of it shows or it is animated (marquee). */
  const shown = (el, r) => {
    let { left, right, top, bottom } = r;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.animationName !== 'none' && cs.animationDuration !== '0s' && /infinite/.test(cs.animationIterationCount)) return null;
      if (p === el || p === document.body) continue;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        if (cs.overflowX !== 'visible') { left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
        if (cs.overflowY !== 'visible') { top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); }
      }
    }
    return right - left > 0 && bottom - top > 0 ? { left, right, top, bottom, width: right - left, height: bottom - top } : null;
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const t = el.getAttribute('data-testid');
    if (t) s += `[data-testid=${t}]`;
    else if (typeof el.className === 'string' && el.className.trim()) s += `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
    const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return txt ? `${s} "${txt}"` : s;
  };
  /* Text that exists for screen readers only (MUI visuallyHidden, "(otevře se v novém okně)"): 1 px, clipped. Not a layout defect. */
  const srOnly = (el) => {
    for (let p = el, i = 0; p && i < 3; p = p.parentElement, i += 1) {
      const cs = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip) || /inset\(50%\)/.test(cs.clipPath) || (cs.position === 'absolute' && r.width <= 2 && r.height <= 2)) return true;
    }
    return false;
  };
  const clippedByAncestor = (el, axis) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if (o !== 'visible') return true;
    }
    return false;
  };
  const doc = document.documentElement;
  const out = {};

  // 1 horizontal overflow
  const sw = Math.max(doc.scrollWidth, document.body.scrollWidth);
  const offenders = [];
  if (sw > vw + 1) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && visible(el) && !clippedByAncestor(el, 'x') && getComputedStyle(el).position !== 'fixed') {
        offenders.push(`${sel(el)} L${Math.round(r.left)} R${Math.round(r.right)}`);
        if (offenders.length >= 5) break;
      }
    }
  }
  out.hOverflow = { px: Math.max(0, sw - vw), offenders };

  // 2 page scroll
  const sh = Math.max(doc.scrollHeight, document.body.scrollHeight);
  out.pageScroll = { scrollHeight: sh, overBy: Math.max(0, sh - vh) };

  // 3 content extents: text ranges + media + controls
  let minL = Infinity; let maxR = -Infinity; let n = 0;
  const textRects = [];
  const mainEl = document.querySelector('main') ?? document.body; /* the page's own content: header and footer span the window by design */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el) || srOnly(el)) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const b0 = range.getBoundingClientRect();
    if (b0.right <= 0) continue; // off-canvas skip link
    const lines = rects.map((r) => shown(el, r)).filter((r) => r !== null);
    if (lines.length === 0) continue;
    if (mainEl.contains(el)) for (const b of lines) { minL = Math.min(minL, b.left); maxR = Math.max(maxR, b.right); }
    textRects.push({ el, lines, raw: b0, t: node.nodeValue.trim().slice(0, 24), id: textRects.length });
    n += 1;
  }
  for (const el of mainEl.querySelectorAll('img,video,canvas,input,select,textarea,button,iframe')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= 0) continue;
    minL = Math.min(minL, r.left); maxR = Math.max(maxR, r.right);
  }
  for (const el of mainEl.querySelectorAll('[data-fit-workspace] > *, [data-fit-workspace] > * > *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.right <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'contents') continue;
    minL = Math.min(minL, r.left); maxR = Math.max(maxR, r.right);
  }
  const gl = Number.isFinite(minL) ? Math.round(minL) : null;
  const gr = Number.isFinite(maxR) ? Math.round(vw - maxR) : null;
  out.extents = { left: gl, right: gr, used: gl === null ? 0 : +((maxR - minL) / vw).toFixed(3), asym: gl === null ? 0 : Math.abs(gl - gr), texts: n };

  // 4 touch targets
  const small = []; const inlineSmall = [];
  for (const el of document.body.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],summary,[tabindex="0"]')) {
    if (el.disabled || el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) continue;
    if (el.type === 'hidden') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left < -2000) continue;
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && Number(cs.opacity) === 0) continue;
    if (srOnly(el) || r.width <= 2 || r.height <= 2) continue;
    // a native input inside a MUI field: the field (label + box) is the target
    const field = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') ? el.closest('.MuiInputBase-root') : null;
    const fr = field !== null ? field.getBoundingClientRect() : r;
    if (fr.width >= 43.5 && fr.height >= 43.5) continue;
    const isInline = cs.display === 'inline' && el.tagName === 'A' && el.closest('p,li,span,label,td,dd');
    (isInline ? inlineSmall : small).push(`${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  out.touch = { small: small.slice(0, 12), count: small.length, inlineCount: inlineSmall.length, inline: inlineSmall.slice(0, 4) };

  // 5 clipped text
  const clipped = [];
  for (const { el } of textRects) {
    if (clipped.length >= 10) break;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) clipped.push(`${sel(el)} x${el.scrollWidth}>${el.clientWidth}`);
  }
  for (const { el, raw: r } of textRects) {
    if (clipped.length >= 10) break;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') break; // a scroller: the text is reachable, not cut off
      if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') continue;
      const pr = p.getBoundingClientRect();
      if (r.right > pr.right + 2 || r.left < pr.left - 2) { clipped.push(`${sel(el)} sticks out of ${sel(p)} by ${Math.round(Math.max(r.right - pr.right, pr.left - r.left))}`); }
      break;
    }
  }
  out.clipped = clipped;

  // 5b overlapping text
  const overlap = [];
  const flat = [];
  for (const t of textRects) {
    if (t.el.closest('[data-marquee],[class*=marquee]')) continue;
    let stuck = false;
    for (let q = t.el; q && q !== document.body; q = q.parentElement) { const ps = getComputedStyle(q).position; if (ps === 'fixed' || ps === 'sticky') { stuck = true; break; } }
    if (stuck) continue;
    for (const r of t.lines) flat.push({ r, t: t.t, id: t.id });
  }
  flat.sort((a, b) => a.r.top - b.r.top);
  for (let i = 0; i < flat.length && overlap.length < 8; i += 1) {
    for (let j = i + 1; j < flat.length; j += 1) {
      if (flat[j].r.top > flat[i].r.bottom) break;
      if (flat[i].id === flat[j].id) continue;
      const a = flat[i].r; const b = flat[j].r;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 3 && iy > 3) {
        const area = ix * iy; const small2 = Math.min(a.width * a.height, b.width * b.height);
        if (area > small2 * 0.4) { overlap.push(`"${flat[i].t}" x "${flat[j].t}" ${Math.round(ix)}x${Math.round(iy)}`); break; }
      }
    }
  }
  out.overlap = overlap;

  // 6 fixed / sticky bars
  const bars = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!visible(el) || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.height < 8) continue;
    bars.push({ s: sel(el), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), pos: cs.position });
  }
  out.bars = bars;
  out.barTopMax = Math.max(0, ...bars.filter((b) => b.top <= 1).map((b) => b.h));
  out.barBottomMax = Math.max(0, ...bars.filter((b) => b.bottom >= vh - 1 && b.pos === 'fixed').map((b) => b.h));

  // 7 images
  const imgs = [...document.body.querySelectorAll('img')].filter(visible);
  out.imgs = {
    count: imgs.length,
    noIntrinsic: imgs.filter((i) => (!i.getAttribute('width') || !i.getAttribute('height')) && getComputedStyle(i).aspectRatio === 'auto').map(sel).slice(0, 6),
  };

  // 8 forms
  const formIssues = [];
  for (const el of document.body.querySelectorAll('input,select,textarea')) {
    if (!visible(el) || ['hidden', 'checkbox', 'radio', 'file', 'submit', 'button'].includes(el.type)) continue;
    const r = el.getBoundingClientRect();
    const lab = el.labels && el.labels[0];
    let labW = 0; let labClipped = false;
    if (lab && visible(lab)) {
      const range = document.createRange(); range.selectNodeContents(lab);
      labW = range.getBoundingClientRect().width;
      labClipped = lab.scrollWidth > lab.clientWidth + 2 && getComputedStyle(lab).overflowX !== 'visible';
    }
    const tooNarrow = r.width < 120 && el.type !== 'number' && el.inputMode !== 'numeric' && el.inputMode !== 'decimal';
    const narrowerThanLabel = labW > 0 && r.width + 1 < labW && el.tagName !== 'SELECT';
    if (tooNarrow || narrowerThanLabel || labClipped) formIssues.push(`${sel(el)} w${Math.round(r.width)} label${Math.round(labW)}${labClipped ? ' CLIPPED' : ''}`);
  }
  out.forms = formIssues.slice(0, 8);

  // 9 dialogs
  out.dialogs = [...document.querySelectorAll('[role=dialog],dialog[open]')].filter(visible).map((d) => {
    const r = d.getBoundingClientRect();
    return { s: sel(d), h: Math.round(r.height), w: Math.round(r.width), tallerThanViewport: r.height > vh + 1, widerThanViewport: r.width > vw + 1 };
  });
  return out;
}

/* after measuring: scroll every scroll container to its bottom and see whether a fixed bar covers text */
function coverage() {
  const cs = (el) => getComputedStyle(el);
  const scrollers = [document.scrollingElement, ...[...document.body.querySelectorAll('*')].filter((e) => {
    const s = cs(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 0;
  })];
  for (const s of scrollers) s.scrollTop = s.scrollHeight;
  const fixed = [...document.body.querySelectorAll('*')].filter((e) => cs(e).position === 'fixed' && cs(e).pointerEvents !== 'none' && e.getBoundingClientRect().height > 8 && cs(e).visibility !== 'hidden' && cs(e).display !== 'none');
  const covered = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName) || cs(el).visibility === 'hidden' || cs(el).display === 'none') continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width === 0 || r.bottom <= 0 || r.top >= innerHeight) continue;
    for (const f of fixed) {
      if (f.contains(el)) continue;
      const fr = f.getBoundingClientRect();
      const iy = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top);
      const ix = Math.min(r.right, fr.right) - Math.max(r.left, fr.left);
      if (ix > 2 && iy > 4) { covered.push(`"${node.nodeValue.trim().slice(0, 24)}" under ${f.tagName.toLowerCase()}`); break; }
    }
  }
  for (const s of scrollers) s.scrollTop = 0;
  return covered.slice(0, 6);
}

export function failures(r) {
  const f = [];
  if (r.error) return ['error'];
  if (r.hOverflow.px > 1) f.push('h-overflow');
  if (r.kind === 'app' && r.pageScroll.overBy > 1) f.push('page-scroll');
  const wide = r.w >= 768;
  const maxGutter = r.kind === 'marketing' ? Math.max(48, (r.w - 1320) / 2 + 48) : Math.max(48, r.w * 0.22);
  if (r.kind === 'app' && r.extents.left !== null && r.extents.asym > 24) f.push('gutter-asym');
  if (r.extents.left !== null && wide && r.kind === 'app' && (r.extents.left > maxGutter || r.extents.right > maxGutter)) f.push('dead-side');
  if (r.kind === 'marketing' && r.w >= 1700 && r.extents.used < 0.6) f.push('dead-side');
  if (r.touch.small.length) f.push('touch');
  if (r.clipped.length) f.push('clipped');
  if (r.overlap.length) f.push('overlap');
  if (r.covered.length) f.push('covered-by-bar');
  if (r.imgs.noIntrinsic.length) f.push('img-no-size');
  if (r.cls > 0.25) f.push('cls');
  if (r.forms.length) f.push('form-narrow');
  if (r.dialogs.some((d) => d.tallerThanViewport || d.widerThanViewport)) f.push('dialog-oversize');
  if (r.barTopMax > r.h * 0.25 || r.barBottomMax > r.h * 0.25) f.push('bar-too-big');
  return f;
}

/* ── mocks (only where a real link cannot be minted: manage / feedback tokens are stored as hashes) ── */
async function installMock(page, which) {
  if (which !== 'manage') return;
  // The booking itself is invented (its token cannot be minted); the činnost/calendar ids are the dev offer's real ones so
  // that "Přesunout na jiný čas" has real free days to show.
  const offer = JSON.parse((await realGet(`${process.env.API ?? 'http://localhost:5092'}/api/public/booking/offer`)).body.toString('utf8'));
  const activity = (offer.data ?? []).flatMap((x) => x.activities)[0];
  const start = new Date(Date.now() + 5 * 86400000); start.setUTCHours(8, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60000);
  const body = { success: true, message: '', data: {
    appointmentId: '00000000-0000-0000-0000-000000000001', serviceName: 'Sportovní prohlídky', activityName: activity?.name ?? 'Základní prohlídka',
    startUtc: start.toISOString(), endUtc: end.toISOString(), isCancelled: false, calendarId: activity?.calendarId ?? null, activityId: activity?.id ?? null,
    canChangeUntilUtc: new Date(start.getTime() - 86400000).toISOString(), agreedPriceCzk: 1200, listPriceCzk: 1200,
  } };
  await page.route('**/api/public/booking/manage/**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }) : route.continue()));
}

/*
 * The API limits every address to 600 requests a minute and the dev stack is shared with other sessions on the same
 * address, so a matrix of hundreds of page loads would measure 429 pages. Public GETs are therefore fetched once for
 * real (waiting out a 429), kept, and replayed for every viewport. The data is the dev API's own, not invented.
 */
const cache = new Map();
/* Fetched for real, once per URL. A 429 (somebody else is using the address's budget), a 5xx or a refused connection is waited out and
   retried, and never kept: a page measured against an answer of "too many requests" would be measuring its error screen. */
async function realGet(url) {
  if (cache.has(url)) return cache.get(url);
  const job = (async () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (res.status !== 429 && res.status < 500) return { status: res.status, contentType: res.headers.get('content-type') ?? 'application/json', body: Buffer.from(await res.arrayBuffer()) };
      } catch { /* refused: the API is restarting */ }
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000));
    }
    throw new Error(`api unavailable: ${url}`);
  })();
  cache.set(url, job);
  job.catch(() => cache.delete(url));
  return job;
}
async function replayPublicGets(page) {
  await page.route('**/api/public/**', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET' || process.env.NO_CACHE) return route.continue();
    const u = new URL(req.url());
    const real = await realGet(`${process.env.API ?? 'http://localhost:5092'}${u.pathname}${u.search}`);
    return route.fulfill({ status: real.status, contentType: real.contentType, body: real.body });
  });
}

if (!process.env.AUDIT_IMPORT_ONLY) {
  const only = arg('only')?.split(',');
  const vpFilter = arg('vp')?.split(',');
  const kindFilter = arg('kind');
  const pages = PAGES.filter((p) => (!only || only.includes(p.id)) && (!kindFilter || p.kind === kindFilter));
  const vps = VIEWPORTS.filter((v) => !vpFilter || vpFilter.includes(`${v.w}x${v.h}`) || vpFilter.includes(v.label ?? ''));
  const concurrency = Number(process.env.CONC ?? 4);

  /* One browser, relaunched when something (another session's cleanup, a crash) closes it; every record is appended to
     <OUT>.jsonl the moment it exists, and a rerun with RESUME=1 skips the ones already there. */
  let browserPromise = null;
  const launch = () => {
    browserPromise = chromium.launch({ executablePath: process.env.CHROME, headless: true }).then((b) => {
      b.on('disconnected', () => { browserPromise = null; });
      return b;
    });
    return browserPromise;
  };
  const getBrowser = () => browserPromise ?? launch();

  const key = (p, v) => `${p.id}|${v.label ?? `${v.w}x${v.h}`}`;
  const done = new Map();
  if (process.env.RESUME && existsSync(`${OUT}.jsonl`)) {
    for (const line of readFileSync(`${OUT}.jsonl`, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const r = JSON.parse(line);
      if (!r.error) done.set(`${r.page}|${r.vp}`, r);
    }
  } else writeFileSync(`${OUT}.jsonl`, '');
  const jobs = [];
  for (const p of pages) for (const v of vps) if (!done.has(key(p, v))) jobs.push({ p, v });
  let idx = 0;

  const run = async (p, v) => {
    const browser = await getBrowser();
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: v.touch, isMobile: v.touch && v.w < 1100, locale: 'cs-CZ', timezoneId: 'Europe/Prague' });
    const rec = { page: p.id, kind: p.kind, mock: p.mock ?? null, vp: v.label ?? `${v.w}x${v.h}`, cls: v.cls, w: v.w, h: v.h };
    try {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__cls = 0;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* */ }
      });
      await replayPublicGets(page);
      let apiTrouble = 0;
      page.on('response', (res) => { if (res.url().includes('/api/') && (res.status() === 429 || res.status() >= 500)) apiTrouble += 1; });
      if (p.mock) await installMock(page, p.mock);
      const path = typeof p.path === 'function' ? p.path() : p.path;
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      for (const step of p.steps ?? []) {
        const [kind, selector] = step.split('?');
        if (kind !== 'click') continue;
        const target = page.locator(selector).first();
        if (await target.isVisible().catch(() => false)) { await target.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(900); }
      }
      const m = await page.evaluate(measure, { vw: v.w, vh: v.h });
      m.covered = await page.evaluate(coverage);
      m.layoutShift = +(await page.evaluate(() => window.__cls)).toFixed(3);
      m.bodyText = (await page.evaluate(() => document.body.innerText.trim().slice(0, 80))).replace(/\s+/g, ' ');
      if (apiTrouble > 0) throw new Error(`api unavailable: ${apiTrouble} answers of 429/5xx while measuring`);
      Object.assign(rec, m);
      rec.fail = failures({ ...rec, cls: m.layoutShift });
      if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${p.id}-${rec.vp}.png`, fullPage: false });
    } finally {
      await ctx.close().catch(() => {});
    }
    return rec;
  };

  const worker = async () => {
    while (idx < jobs.length) {
      const { p, v } = jobs[idx++];
      let rec;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          // a page that never answers must not stop the matrix: after 100 s the browser is thrown away and the job tried again
          rec = await Promise.race([run(p, v), new Promise((_, reject) => setTimeout(() => reject(new Error('job timeout: browser closed')), 100000))]);
          break;
        } catch (e) {
          if (String(e.message ?? e).startsWith('job timeout')) { const dead = browserPromise; browserPromise = null; void dead?.then((b) => b.close()).catch(() => {}); }
          const message = String(e.message ?? e);
          rec = { page: p.id, kind: p.kind, mock: p.mock ?? null, vp: v.label ?? `${v.w}x${v.h}`, cls: v.cls, w: v.w, h: v.h, error: message.slice(0, 200), fail: ['error'] };
          if (/closed|disconnected|crash/i.test(message)) await new Promise((r) => setTimeout(r, 1500));
        }
      }
      appendFileSync(`${OUT}.jsonl`, `${JSON.stringify(rec)}\n`);
      if (process.env.VERBOSE) console.error('done', rec.page, rec.vp, (rec.fail ?? []).join(','));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (browserPromise) await Promise.race([(await browserPromise).close(), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
  const results = readFileSync(`${OUT}.jsonl`, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  results.sort((a, b) => a.page.localeCompare(b.page) || a.w - b.w);
  writeFileSync(OUT, JSON.stringify(results, null, 1));
  const summary = {};
  for (const r of results) for (const k of r.fail) { summary[k] ??= 0; summary[k] += 1; }
  console.log(`records: ${results.length}`);
  console.log(JSON.stringify(summary));
}
