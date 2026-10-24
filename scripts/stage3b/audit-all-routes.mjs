/*
 * R15e: "it cannot be light for only half the system". Every route of the staff app (read from src/StaffApp.tsx, so a new route
 * is audited without touching this file), in LIGHT mode, in one run, one line per route:
 *
 *   - no large dark surface: the share of the viewport whose surface is darker than relative luminance 0.1 must be <= 5 %;
 *   - text AA (4.5:1, 3:1 large), icons and controls 3:1 (audit-lib.mjs) - no light-on-light, no dark-on-dark;
 *   - the document never scrolls and nothing overflows sideways (the app shell is 100dvh).
 *
 *   node scripts/stage3b/audit-all-routes.mjs [--modes=light,dark] [--sizes=desktop,phone] [--accent=#EA580C] [--only=text] [--out=file.json]
 *
 * Dark mode is run for the contrast numbers only (the dark-surface rule is a light-mode rule). Parameter routes take the first
 * record of the dev data (patient, club, order, calendar, služba); a route whose record does not exist is reported SKIPPED.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, newPage, login, setTheme, api, jpg, waitPlanner, BASE } from './lib.mjs';
import { auditRegion, darkSurfaces, summarise } from './audit-lib.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const modes = (flag('modes') ?? 'light').split(',');
const sizes = (flag('sizes') ?? 'desktop').split(',');
const accent = flag('accent') ?? '#0D5C52';
const only = flag('only');
const shots = args.includes('--shots');
const out = flag('out');
const DARK_SHARE_LIMIT = 0.05;

const src = readFileSync('src/StaffApp.tsx', 'utf8');
/* every static path of the table; nested patient tabs are joined to their parent; the catch-all and the DEV gallery are not routes to audit */
const paths = [...src.matchAll(/<Route\s+(?:index|path="([^"]+)")/g)].map((m) => m[1]).filter(Boolean);
const patientTabs = ['dokumenty', 'terminy', 'historie', 'vysledky', 'faktury'];
const routes = [];
for (const p of paths) {
  if (p === '*' || p.startsWith('/audit/')) continue;
  if (!p.startsWith('/')) continue; /* nested tabs handled below */
  routes.push(p);
}
for (const t of patientTabs) routes.push(`/patients/:id/${t}`);
for (const g of ['provoz', 'sluzby-a-ceny', 'kluby', 'komunikace', 'dokumenty', 'vzhled-webu', 'system']) routes.push(`/settings/${g}`);
routes.push('/nastaveni/barvy');
const unique = [...new Set(routes)].filter((r) => r !== '/settings/:group' && r !== '/nastaveni/barvy' && r !== '/clubs/rezervace');

const browser = await launch();
const results = [];
for (const size of sizes) {
  const loginPage = await newPage(browser, size);
  await login(loginPage);
  const ctx = loginPage.context();
  const page = loginPage;
  const first = async (path, pick) => { try { const r = await api(page, 'GET', path); return pick(r.json); } catch { return null; } };
  const ids = {
    id: await first('/api/patients?pageSize=1', (j) => (j?.data?.items ?? j?.items ?? j?.data ?? j)?.[0]?.id ?? null),
    clubId: await first('/api/clubs', (j) => (j?.data ?? j)?.[0]?.id ?? null),
    orderId: await first('/api/v1/club-orders', (j) => (j?.data?.items ?? j?.data ?? j?.items ?? j)?.[0]?.id ?? null),
    calendarId: await first('/api/calendars', (j) => (j?.data ?? j?.calendars ?? j)?.[0]?.id ?? null),
    serviceId: await first('/api/clinic-services', (j) => (j?.data ?? j)?.[0]?.id ?? null),
  };
  for (const mode of modes) {
    await setTheme(page, mode, accent);
    for (const template of unique) {
      if (only && !template.includes(only)) continue;
      const missing = [...template.matchAll(/:(\w+)/g)].map((m) => m[1]).find((k) => !ids[k]);
      if (template.includes(':appointmentId') || missing) {
        results.push({ size, mode, route: template, skipped: template.includes(':appointmentId') ? 'needs a booked appointment id' : `no ${missing} in the dev data` });
        console.log(`${size} ${mode} ${template}: SKIPPED`);
        continue;
      }
      const url = template.replace(/:(\w+)/g, (_, k) => ids[k]);
      const planner = /planovani|kalendar$/.test(url);
      /* a fresh tab per route (same context, same login): one long-lived tab runs out of memory over ~70 routes */
      const tab = await ctx.newPage();
      try {
        await tab.goto(BASE + url);
        if (planner) await waitPlanner(tab).catch(() => {});
        else await tab.waitForSelector('main#main-content, #main-content, [role=main], .sm-planner', { timeout: 15000 }).catch(() => {});
        await tab.waitForTimeout(planner ? 500 : 1500);
        const items = await auditRegion(tab, 'body', { viewportOnly: true });
        const s = summarise(items);
        const dark = await darkSurfaces(tab);
        const layout = await tab.evaluate(() => ({ docScroll: document.documentElement.scrollHeight > innerHeight + 1, hOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        const darkFail = mode === 'light' && dark.darkShare > DARK_SHARE_LIMIT;
        const empty = s.total === 0; /* nothing audited = a blank or crashed page, never a pass */
        const row = { size, mode, route: template, url: url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'), darkShare: Math.round(dark.darkShare * 1000) / 10, darkFail, empty, darkBy: dark.examples, ...layout, counts: { text: s.text, icon: s.icon, control: s.control, total: s.total, failed: s.failed }, fails: s.fails.slice(0, 25) };
        results.push(row);
        if (shots) await jpg(tab, `all-${size}-${mode}-${template.replace(/[^a-z0-9]+/gi, '_')}`, 40);
        console.log(`${size} ${mode} ${template}: dark ${row.darkShare}%${darkFail ? ' FAIL' : ''}${empty ? '  EMPTY-PAGE' : ''}  text ${s.text.failed}/${s.text.checked}  icon ${s.icon.failed}/${s.icon.checked}  control ${s.control.failed}/${s.control.checked}${layout.docScroll ? '  DOC-SCROLL' : ''}${layout.hOverflow ? '  H-OVERFLOW' : ''}`);
      } catch (e) {
        results.push({ size, mode, route: template, skipped: String(e.message).split('\n')[0].slice(0, 100) });
        console.log(`${size} ${mode} ${template}: ERROR ${String(e.message).split('\n')[0].slice(0, 80)}`);
      }
    }
  }
  await ctx.close();
}
const ran = results.filter((r) => !r.skipped);
const sum = ran.reduce((a, r) => ({ routes: a.routes + 1, empty: a.empty + (r.empty ? 1 : 0), dark: a.dark + (r.darkFail ? 1 : 0), text: a.text + r.counts.text.failed, icon: a.icon + r.counts.icon.failed, control: a.control + r.counts.control.failed, scroll: a.scroll + (r.docScroll ? 1 : 0), over: a.over + (r.hOverflow ? 1 : 0) }), { routes: 0, empty: 0, dark: 0, text: 0, icon: 0, control: 0, scroll: 0, over: 0 });
console.log(`ROUTES audited ${sum.routes}, skipped ${results.length - ran.length}; routes with a large dark surface ${sum.dark}; empty pages ${sum.empty}; text failures ${sum.text}; icon failures ${sum.icon}; control failures ${sum.control}; document scroll ${sum.scroll}; sideways overflow ${sum.over}`);
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
await browser.close();
