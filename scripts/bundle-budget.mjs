/* ══════════════════════════════════════════════════════════════
   BUNDLE BUDGET  (npm run build:check - run after `npm run build`; NOT part of the Vercel build)

   Reads dist/.vite/manifest.json and the built files and checks two things:

   1. SIZE: the script a screen has to download (brotli, what Vercel serves) must not grow more than 10 % over the
      numbers in scripts/bundle-budget.json. The measured groups are the application entry (what /login and the
      patients' pages download), the public site's entry, the staff portal's shell and the planner (the calendar,
      `/planovani` and `/clubs/:id`).
   2. SHAPE: some libraries must never be in a first load. The charts library, the HEIC converter, the animation
      library and the SignalR client each load only where they are used; if a change pulls one into the application
      entry (a shared import is enough) this fails and names the import chain's first link.

   When a growth is intended: run `node scripts/bundle-budget.mjs --update` and commit the new numbers with the reason.
   ══════════════════════════════════════════════════════════════ */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.BUDGET_DIST ? path.resolve(process.env.BUDGET_DIST) : path.join(root, 'dist');
const budgetPath = path.join(root, 'scripts', 'bundle-budget.json');
const TOLERANCE = 0.1;

/** The groups: [name, manifest key of its root, the groups whose files it does not count again]. */
export const GROUPS = [
  ['app-entry', ['index.html', 'src/web/appEntry.tsx'], []],
  ['public-entry', ['index.html', 'src/web/entry-client.tsx'], []],
  ['login', ['src/pages/Login.tsx'], ['app-entry']],
  ['staff-portal', ['src/StaffApp.tsx'], ['app-entry']],
  ['dashboard', ['src/pages/Dashboard.tsx'], ['app-entry', 'staff-portal']],
  ['planner', ['src/planner/PlannerPage.tsx', 'src/planner/ClubPlannerPage.tsx'], ['app-entry', 'staff-portal']],
];

/** Libraries that must not be in these groups' static closure. */
export const FORBIDDEN = [
  ['app-entry', /^(charts|heic-to|motion|signalr|gsap|lenis|shaders)$/, 'the charts, HEIC, animation, scroll-scene, smooth-scroll and shader libraries load only where they are used'],
  ['login', /^(charts|heic-to|motion|signalr|gsap|lenis|shaders)$/, 'the sign-in page must not carry them'],
  ['staff-portal', /^(heic-to|motion|gsap|lenis|shaders)$/, 'the HEIC converter loads only when somebody picks a HEIC photo; the animation library is fetched after the first paint (src/motion/engine.ts), and GSAP, Lenis and the shaders belong to the public site only'],
  ['planner', /^(heic-to|charts|DemoDataSource|motion|gsap|lenis|shaders)$/, 'the planner must not carry the HEIC converter, the charts, the demo data or any animation library (its drop settle is CSS)'],
  ['public-entry', /^(charts|heic-to|signalr|StaffApp|motion|gsap|lenis|shaders)$/, 'the public site must not carry the application, and its motion libraries load after the first paint'],
];

/** `assets/charts-BdwChCap.js` -> `charts` */
export function chunkName(file) {
  const base = path.basename(file).replace(/\.m?js$/, '');
  return base.replace(/-[A-Za-z0-9_-]{8}$/, '');
}

/** Files of the static import closure of the given manifest keys (JS only), in discovery order. */
export function closure(manifest, keys) {
  const seen = new Set();
  const files = [];
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined) return;
    files.push(chunk.file);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const key of keys) visit(key);
  return files;
}

const brotliSize = (file) =>
  brotliCompressSync(readFileSync(path.join(dist, file)), { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length;

export function measure(manifest) {
  const closures = new Map();
  for (const [name, keys] of GROUPS) closures.set(name, closure(manifest, keys));
  const sizes = {};
  const detail = {};
  for (const [name, , minus] of GROUPS) {
    const skip = new Set(minus.flatMap((other) => closures.get(other) ?? []));
    const own = (closures.get(name) ?? []).filter((file) => !skip.has(file) && file.endsWith('.js'));
    detail[name] = own;
    sizes[name] = own.reduce((sum, file) => sum + brotliSize(file), 0);
  }
  return { sizes, detail, closures };
}

function main() {
  const manifestPath = path.join(dist, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`bundle-budget: ${manifestPath} is missing - run \`npm run build\` first`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { sizes, closures } = measure(manifest);
  const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

  if (process.argv.includes('--update')) {
    writeFileSync(budgetPath, `${JSON.stringify({ unit: 'bytes, brotli', tolerance: TOLERANCE, baseline: sizes }, null, 2)}\n`);
    console.log('bundle-budget: wrote scripts/bundle-budget.json');
    for (const [name, size] of Object.entries(sizes)) console.log(`  ${name.padEnd(14)} ${kb(size)}`);
    return;
  }

  const failures = [];
  const budget = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')) : null;
  console.log('bundle-budget: script a screen downloads (brotli)');
  for (const [name] of GROUPS) {
    const actual = sizes[name];
    const base = budget?.baseline?.[name];
    const limit = base === undefined ? null : Math.round(base * (1 + (budget.tolerance ?? TOLERANCE)));
    const state = limit === null ? 'no baseline' : actual > limit ? 'OVER' : 'ok';
    console.log(`  ${name.padEnd(14)} ${kb(actual).padStart(10)}   baseline ${base === undefined ? '-' : kb(base)}  limit ${limit === null ? '-' : kb(limit)}  ${state}`);
    if (limit !== null && actual > limit) failures.push(`${name}: ${kb(actual)} is over the limit ${kb(limit)} (baseline ${kb(base)} + 10 %)`);
  }
  for (const [group, pattern, why] of FORBIDDEN) {
    const bad = (closures.get(group) ?? []).map(chunkName).filter((name) => pattern.test(name));
    if (bad.length > 0) failures.push(`${group} imports ${[...new Set(bad)].join(', ')} statically - ${why}`);
  }
  if (failures.length > 0) {
    console.error('\nbundle-budget FAILED:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('bundle-budget: ok');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
