/*
 * R6 pixel test on the real stack: for every accent (6) x both themes (2) the holiday column of the week board (28. 10. 2026) is ONE
 * opaque block - every pixel of the block below its label is the block's own fill (no hour line, no hatch, no grid shows through) -
 * the label reads at AA on the fill, the fill is the same red whatever the accent, and the weekend column is the neutral grey.
 *
 *   node scripts/stage2/r6-pixels.mjs            (frontend :3005, API :5092; BASE / DEV_LOGIN as the other stage-2 scripts)
 */
import './env.mjs';
import { launch, newPage, login, shot, waitPlanner, BASE } from './lib.mjs';

const ACCENTS = { forest: '#0D5C52', slate: '#2B3440', teal: '#0D9488', blue: '#2563EB', purple: '#7C3AED', orange: '#EA580C' };
const MODES = (process.env.MODES ?? 'dark,light').split(',');
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const rgbOf = (css) => (/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css) ?? []).slice(1, 4).map(Number);

const browser = await launch();
let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failed += 1;
};

for (const mode of MODES) {
  for (const [key, accent] of Object.entries(ACCENTS)) {
    const page = await newPage(browser, 'desktop');
    await page.addInitScript(([k, a, m]) => {
      localStorage.setItem('sm-theme-accent', a);
      localStorage.setItem('sm-theme-mode-v2', m);
    }, [key, accent, mode]);
    await login(page);
    await page.goto(`${BASE}/planovani`);
    await waitPlanner(page);
    await page.click('[data-command=nextWeek]');
    await page.waitForTimeout(1800);
    const tag = `${key}/${mode}`;
    for (const [day, kind, expectFill] of [['2026-10-28', 'holiday', '#C62828'], ['2026-10-31', 'closed', '#3F4852']]) {
      const block = page.locator(`[data-testid=closed-${day}]`);
      const box = await block.boundingBox();
      if (!box) { check(false, `${tag} ${day}: block missing`); continue; }
      const fill = await block.evaluate((el) => el.style.getPropertyValue('--lock-fill'));
      check(fill.toUpperCase() === expectFill, `${tag} ${kind}: fill is ${fill} (fixed ${expectFill}, accent-independent)`);
      /* the label's ink on the fill reads at AA (computed style, not the model) */
      const colours = await block.evaluate((el) => {
        const cs = getComputedStyle(el);
        const label = getComputedStyle(el.querySelector('.board-lock-label strong'));
        return { bg: cs.backgroundColor, bgImage: cs.backgroundImage, ink: label.color, op: cs.opacity };
      });
      const bg = rgbOf(colours.bg);
      const r = ratio(rgbOf(colours.ink), bg);
      check(r >= 4.5 && colours.bgImage === 'none' && colours.op === '1', `${tag} ${kind}: computed ink/fill ${r.toFixed(2)}:1, background-image ${colours.bgImage}, opacity ${colours.op}`);
      /* pixels: every pixel of the block below the label is the fill */
      const clip = { x: Math.round(box.x) + 2, y: Math.round(box.y) + 200, width: Math.round(box.width) - 4, height: Math.round(box.height) - 204 };
      const png = (await page.screenshot({ clip })).toString('base64');
      const stats = await page.evaluate(async ({ png, bg }) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, img.width, img.height).data;
        let off = 0; let worst = 0;
        for (let i = 0; i < d.length; i += 4) {
          const dev = Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));
          if (dev > 2) off += 1;
          worst = Math.max(worst, dev);
        }
        return { w: img.width, h: img.height, off, worst };
      }, { png, bg });
      check(stats.off === 0, `${tag} ${kind}: ${stats.w}x${stats.h} px sampled below the label, ${stats.off} differ from the fill (worst delta ${stats.worst}) - no hour line, hatch or card shows through`);
      if (day === '2026-10-28' && key === 'forest') {
        /* control: the same measurement on the neighbouring OPEN column must find lines / cards (the test can fail) */
        const neighbour = { ...clip, x: clip.x - Math.round(box.width) };
        const png2 = (await page.screenshot({ clip: neighbour })).toString('base64');
        const control = await page.evaluate(async ({ png, bg }) => {
          const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
          const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, img.width, img.height).data; let off = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) > 2) off += 1;
          return off;
        }, { png: png2, bg });
        check(control > 1000, `${tag} control: the open neighbouring column has ${control} pixels that differ from the block fill (the check can fail)`);
      }
    }
    if (key === 'forest' || key === 'orange') await shot(page, `r6-pixels-${key}-${mode}`);
    await page.context().close();
  }
}
await browser.close();
console.log(failed === 0 ? '\nALL R6 PIXEL CHECKS PASS' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
