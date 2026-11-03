/*
 * Accessibility check (axe-core, WCAG 2.x A + AA) of the public pages in a real browser.
 *
 *     node scripts/a11y-check.mjs
 *     env: BASE=http://localhost:3000   ROUTES=/,/login,...   CHROME_PATH=<chrome.exe>   FAIL_ON=serious|critical|none
 *
 * Run it against a dev server or `vite preview`. It uses its OWN headless Chromium (pw-env.mjs finds it; never the
 * shared browser pane), signs in to nothing and prints only rule ids, impact and counts - no page content.
 * Exit code 1 when a violation at FAIL_ON or worse is found (default: serious).
 */
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';
import { findChrome } from './pw-env.mjs';

const BASE = (process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const ROUTES = (process.env.ROUTES ?? '/,/login').split(',').map((r) => r.trim()).filter(Boolean);
const ORDER = ['minor', 'moderate', 'serious', 'critical'];
const FAIL_ON = process.env.FAIL_ON ?? 'serious';
const failAt = FAIL_ON === 'none' ? Infinity : ORDER.indexOf(FAIL_ON);

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
let failing = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    console.log(`${route}: ${violations.length} rule(s) violated`);
    for (const v of violations) {
      console.log(`  ${(v.impact ?? 'n/a').padEnd(8)} ${v.id} (${v.nodes.length} node(s)) ${v.helpUrl}`);
      if (ORDER.indexOf(v.impact ?? 'minor') >= failAt) failing += 1;
    }
  }
} finally {
  await browser.close();
}
if (failing > 0) {
  console.log(`${failing} violation(s) at "${FAIL_ON}" or worse.`);
  process.exit(1);
}
