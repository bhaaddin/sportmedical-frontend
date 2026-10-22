/*
 * R5: the pop-out audit. Every KIND of pop-out of the staff app is opened, in dark and light, for every accent, and its text /
 * icon / control colours are read from the browser (audit-lib.mjs) and checked against WCAG AA (4.5:1 text, 3:1 icons and controls).
 *
 *   node scripts/stage3b/audit-popouts.mjs [--accents] [--only=name,name] [--shots] [--out=file.json]
 *
 * Two sources of scenarios:
 *   - GALLERY: the generic MUI kinds (Dialog, confirm, Popover, Menu, Select, Tooltip, Drawer, Autocomplete, Snackbar/Alert,
 *     form controls) on the DEV-only route /audit/popouts?kind=..., so each is open in the real theme;
 *   - APP: the application's own pop-outs, opened the way a person opens them (the planner's dialogs, bubbles and flyouts, the
 *     club editor, the command palette, the user menu, the notifications, settings dialogs ...). A scenario that cannot be opened
 *     (no data for it on this stack) is reported as SKIPPED with the reason, never silently dropped.
 * The default accent in dark and light is audited for every scenario; --accents repeats all six in both modes.
 */
import { writeFileSync } from 'node:fs';
import { launch, newPage, login, setTheme, ACCENTS, api, jpg, waitPlanner, BASE } from './lib.mjs';
import { auditRegion, summarise } from './audit-lib.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const withAccents = args.includes('--accents');
const shots = args.includes('--shots');
const only = flag('only')?.split(',');
const out = flag('out');

/* what counts as "the pop-out" when it is open */
const OVERLAYS = '.MuiDialog-root, .MuiPopover-root, .MuiPopper-root, .MuiDrawer-root, .MuiSnackbar-root, .MuiAutocomplete-popper, [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], .sm-planner .modal, .sm-planner [class*="dialog"][class*="layer"], .sm-planner .toast, .sm-planner #toast-layer, .sm-planner .popover, .sm-planner .flyout, .sm-planner .mini-day-tooltip, .sm-planner .tooltip';

const GALLERY = ['dialog', 'confirm', 'popover', 'menu', 'select', 'tooltip', 'drawer', 'autocomplete', 'snackbar', 'alerts', 'form-controls'].map((kind) => ({
  name: `gallery:${kind}`,
  route: `/audit/popouts?kind=${kind}`,
  region: kind === 'alerts' || kind === 'form-controls' ? '[data-testid^=popout-]' : OVERLAYS,
  open: async (page) => { await page.waitForSelector(`[data-testid=popout-${kind}]`, { timeout: 30000 }); await page.waitForTimeout(700); },
}));

const click = async (page, loc, wait = 700) => { await loc.first().click({ timeout: 8000 }); await page.waitForTimeout(wait); };
const byText = (page, text) => page.getByRole('button', { name: text });

const APP = [
  { name: 'planner:objednavka', route: '/planovani', planner: true, open: async (p) => click(p, byText(p, /Objednávka/)) },
  { name: 'planner:klub', route: '/planovani', planner: true, open: async (p) => click(p, byText(p, /^\s*Klub/)) },
  { name: 'planner:nastaveni-tabule', route: '/planovani', planner: true, open: async (p) => click(p, p.locator('[aria-label*="astaven"], [data-testid*=board-settings], #board-settings').first()) },
  { name: 'planner:uzivatelske-menu', route: '/planovani', planner: true, open: async (p) => click(p, p.getByText(/MUDr\./)) },
  { name: 'planner:oznameni', route: '/planovani', planner: true, open: async (p) => click(p, p.locator('[aria-label*="znám"], [data-testid*=notif], #notifications-button').first()) },
  { name: 'planner:mini-den-tooltip', route: '/planovani', planner: true, open: async (p) => { await p.locator('[data-testid=mini-day-2026-10-27]').first().hover(); await p.waitForTimeout(900); } },
  { name: 'planner:mini-den-detail', route: '/planovani', planner: true, open: async (p) => click(p, p.locator('[data-testid=mini-day-2026-10-27]')) },
  { name: 'planner:obed', route: '/planovani', planner: true, open: async (p) => { await p.getByText('OBĚD').first().click({ force: true, timeout: 8000 }); await p.waitForTimeout(800); } },
  { name: 'planner:prazdny-slot', route: '/planovani', planner: true, open: async (p) => { const r = await p.evaluate(() => { const b = document.querySelector('#day-board').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }); await p.mouse.click(r.x + (r.w / 7) * 1.5, r.y + r.h * 0.2); await p.waitForTimeout(900); } },
  { name: 'planner:mesic', route: '/planovani', planner: true, open: async (p) => click(p, byText(p, /Měsíc/)) },
  { name: 'shell:paleta-prikazu', route: '/prehled', open: async (p) => { await p.keyboard.press('Control+k'); await p.waitForTimeout(900); } },
  { name: 'clubs:novy-klub', route: '/clubs', open: async (p) => click(p, p.getByRole('button', { name: /Nový klub|Přidat klub/ })) },
  { name: 'club:upravit-klub', route: '/clubs/:club', open: async (p) => click(p, p.getByRole('button', { name: /Upravit/ })) },
  { name: 'club:nova-objednavka', route: '/clubs/:club', open: async (p) => click(p, p.getByRole('button', { name: /Nová objednávka/ })) },
  { name: 'patients:nova-objednavka', route: '/patients', open: async (p) => click(p, p.getByRole('button', { name: /Nová objednávka/ })) },
  { name: 'patients:hledat', route: '/patients', open: async (p) => click(p, p.getByRole('button', { name: /Hledat/ })) },
  { name: 'settings:sluzby-barvy-popover', route: '/nastaveni/barvy-sluzeb', open: async (p) => click(p, p.locator('button[aria-label^="Změnit barvu"]')) },
  { name: 'settings:barva-cinnosti-popover', route: '/nastaveni/barvy-sluzeb', open: async (p) => click(p, p.getByRole('button', { name: 'Základní sportovní prohlídka' })) },
  { name: 'settings:svatky-dialog', route: '/svatky', open: async (p) => click(p, p.getByRole('button', { name: /Přidat|Nový/ })) },
  { name: 'settings:cinnosti-dialog', route: '/activities', open: async (p) => click(p, p.getByRole('button', { name: /Přidat|Nová/ })) },
];

const browser = await launch();
const results = [];
const page = await newPage(browser, 'desktop');
if (args.includes('--baseline')) await page.route(/planner\.light/, (r) => r.abort()); /* the state before the light layer existed */
await login(page);
const clubs = (await api(page, 'GET', '/api/clubs')).json ?? [];
const club = clubs[0];

const combos = [];
for (const mode of ['dark', 'light']) {
  if (withAccents) for (const [k, hex] of ACCENTS) combos.push([mode, k, hex]);
  else combos.push([mode, 'forest', '#0D5C52']);
}
for (const [mode, accent, hex] of combos) {
  for (const sc of [...GALLERY, ...APP]) {
    if (only && !only.some((o) => sc.name.includes(o))) continue;
    const route = sc.route.replace(':club', club?.id ?? 'none');
    await setTheme(page, mode, hex);
    try {
      await page.goto(BASE + route);
      if (sc.planner) await waitPlanner(page);
      else await page.waitForTimeout(sc.name.startsWith('gallery') ? 600 : 1800);
      await sc.open(page);
    } catch (e) {
      results.push({ scenario: sc.name, mode, accent, skipped: String(e.message).split('\n')[0].slice(0, 120) });
      console.log(`${mode} ${accent} ${sc.name}: SKIPPED (${String(e.message).split('\n')[0].slice(0, 90)})`);
      continue;
    }
    const hasOverlay = (await page.locator(sc.region ?? OVERLAYS).count()) > 0;
    const items = await auditRegion(page, hasOverlay ? (sc.region ?? OVERLAYS) : 'body', { viewportOnly: false });
    const s = summarise(items);
    results.push({ scenario: sc.name, mode, accent, overlay: hasOverlay, counts: { text: s.text, icon: s.icon, control: s.control, total: s.total, failed: s.failed }, fails: s.fails.slice(0, 30) });
    if (shots) await jpg(page, `pop-${mode}-${accent}-${sc.name.replace(/[^a-z0-9]+/gi, '_')}`, 45);
    console.log(`${mode} ${accent} ${sc.name}${hasOverlay ? '' : ' (NO OVERLAY FOUND, whole page)'}: text ${s.text.failed}/${s.text.checked}  icon ${s.icon.failed}/${s.icon.checked}  control ${s.control.failed}/${s.control.checked}`);
  }
}
const ran = results.filter((r) => !r.skipped);
const totals = ran.reduce((a, r) => ({ text: a.text + r.counts.text.failed, icon: a.icon + r.counts.icon.failed, control: a.control + r.counts.control.failed }), { text: 0, icon: 0, control: 0 });
console.log(`SCENARIOS run ${ran.length}, skipped ${results.length - ran.length}; FAILURES`, totals);
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
await browser.close();
