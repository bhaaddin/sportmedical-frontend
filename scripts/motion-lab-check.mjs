/*
 * /motion-lab in a real browser, under each of the three settings: every primitive of the kit actually moves (or, under
 * 'omezené' / 'vypnuto', provably does not), and nothing logs an error. Own headless Chromium.
 *
 *     node scripts/motion-lab-check.mjs
 *     env: BASE=http://localhost:4300 (a `vite preview` or the dev server)   OUT_DIR=design/motion
 *
 * Under 'plné': Reveal cards animate (a Web Animation is running on them) and end with no inline style; PopIn runs a spring
 * (a linear() easing) and leaves; the list adds and removes with an animation; the figures count up from 0; Lenis runs
 * (mouse); the scroll scene is ready. Under 'omezené': reveals are fades only (no transform keyframes), no scene, no Lenis.
 * Under 'vypnuto': no animation is created at all by the kit and no transform is ever written. Screenshots of the lab
 * under each state are saved as lab-<state>.png.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://localhost:4300';
const OUT = resolve(root, process.env.OUT_DIR ?? join('design', 'motion'));
mkdirSync(OUT, { recursive: true });
const failures = [];
const expect = (cond, what) => { if (!cond) failures.push(what); };

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: findChrome(), headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });

for (const [mode, slug] of [['plné', 'plne'], ['omezené', 'omezene'], ['vypnuto', 'vypnuto']]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(`try{localStorage.setItem('sm-motion', ${JSON.stringify(mode)})}catch(e){}`);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  await page.goto(`${BASE}/motion-lab`, { waitUntil: 'load' });
  await page.waitForTimeout(3600); // the kit warms after the first paint; scenes and Lenis follow
  await page.screenshot({ path: join(OUT, `lab-${slug}.png`) });

  const state = await page.evaluate(() => ({
    motion: document.documentElement.dataset.motion,
    lenis: document.documentElement.classList.contains('lenis'),
    scene: document.querySelector('[data-scene]')?.getAttribute('data-scene') ?? null,
  }));
  if (mode === 'plné') { expect(state.motion === 'full', `${mode}: data-motion ${state.motion}`); expect(state.lenis, `${mode}: Lenis did not start`); expect(state.scene === 'ready', `${mode}: scene ${state.scene}`); }
  else { expect(!state.lenis, `${mode}: Lenis must not run`); expect(state.scene === null, `${mode}: a scene is mounted (${state.scene})`); }

  // Reveal: scroll the cards into view and watch what the browser runs on them.
  const reveal = await page.evaluate(async () => {
    const cards = Array.from(document.querySelectorAll('section:nth-of-type(2) [style*="opacity"]'));
    const hiddenAtStart = cards.length;
    const target = document.querySelectorAll('section')[1];
    target.scrollIntoView({ block: 'start' });
    window.scrollBy(0, window.innerHeight * 0.9);
    await new Promise((r) => setTimeout(r, 400));
    const animated = Array.from(document.querySelectorAll('section:nth-of-type(2) *')).filter((el) => el.getAnimations().length > 0);
    const keyframeProps = new Set();
    for (const el of animated) for (const a of el.getAnimations()) for (const k of a.effect.getKeyframes()) Object.keys(k).forEach((p) => keyframeProps.add(p));
    await new Promise((r) => setTimeout(r, 1500));
    const left = Array.from(document.querySelectorAll('section:nth-of-type(2) *')).filter((el) => el.style.opacity !== '' || el.style.transform !== '').length;
    return { hiddenAtStart, animated: animated.length, props: [...keyframeProps], inlineLeft: left };
  });
  if (mode === 'plné') {
    expect(reveal.animated > 0, `${mode}: no reveal animation ran (${JSON.stringify(reveal)})`);
    expect(reveal.props.includes('transform') && reveal.props.includes('opacity'), `${mode}: reveals should move and fade (${reveal.props})`);
    expect(reveal.inlineLeft === 0, `${mode}: reveal left inline styles behind (${reveal.inlineLeft})`);
  } else if (mode === 'omezené') {
    expect(!reveal.props.includes('transform'), `${mode}: a reveal wrote transform keyframes (${reveal.props})`);
  } else {
    expect(reveal.animated === 0 && reveal.hiddenAtStart === 0, `${mode}: the kit animated or hid something (${JSON.stringify(reveal)})`);
  }

  // PopIn (spring), the list, the figures.
  await page.getByRole('button', { name: 'PopIn panel' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'PopIn panel' }).click();
  await page.waitForTimeout(60);
  const pop = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Vyskočí z místa kliknutí a odejde rychle.');
    if (!panel) return null;
    // motion/mini puts the easing on the keyframes (the effect's own timing stays 'linear')
    return panel.getAnimations().flatMap((a) => [String(a.effect.getTiming().easing), ...a.effect.getKeyframes().map((k) => String(k.easing))]);
  });
  expect(pop !== null, `${mode}: PopIn did not appear`);
  if (mode === 'plné') expect((pop ?? []).some((e) => e.startsWith('linear(') && e.length > 20), `${mode}: PopIn is not on the spring easing (${pop})`);
  if (mode !== 'plné') expect((pop ?? []).every((e) => !(e.startsWith('linear(') && e.length > 20)), `${mode}: PopIn runs the spring`);

  const items = () => page.locator('.lab-list li').count();
  const before = await items();
  await page.getByRole('button', { name: 'Přidat' }).click();
  await page.waitForTimeout(500);
  expect((await items()) === before + 1, `${mode}: list did not grow`);
  await page.getByRole('button', { name: 'Odebrat' }).click();
  await page.waitForTimeout(700);
  expect((await items()) === before, `${mode}: list did not shrink after the exit`);

  const count = page.getByRole('button', { name: 'Znovu spočítat' });
  await count.scrollIntoViewIfNeeded();
  await count.click();
  await page.waitForTimeout(80);
  const early = await page.evaluate(() => document.querySelector('[class*="MuiTypography"] span')?.textContent);
  await page.waitForTimeout(2600);
  const late = await page.evaluate(() => Array.from(document.querySelectorAll('span')).map((s) => s.textContent).find((t) => t === '1 248' || t === '1 248'));
  expect(late !== undefined, `${mode}: the figure never reached 1 248`);
  if (mode === 'plné') expect(early !== '1 248' && early !== '1 248', `${mode}: the figure did not count (it showed ${early} at once)`);

  for (const e of errors) failures.push(`${mode}: console error: ${e}`);
  await context.close();
  console.log(`lab ${mode}: state ${JSON.stringify(state)}, reveal ${JSON.stringify(reveal)}, pop ${JSON.stringify(pop)?.slice(0, 60)}`);
}
await browser.close();
if (failures.length > 0) {
  console.error('\nFAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('motion-lab-check: ok');
