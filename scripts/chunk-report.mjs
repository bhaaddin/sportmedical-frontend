/* ══════════════════════════════════════════════════════════════
   WHICH SCRIPTS A SCREEN DOWNLOADS, AND WHY  (npm run analyze:chunks -- <manifest key> [<manifest key> ...])

   Reads dist/.vite/manifest.json. For each key it lists the static import closure - the files the browser fetches before
   that code can run - with raw and brotli sizes, and for every file the first chunk that imports it (the "why").
   Keys are source paths as Vite writes them: src/web/appEntry.tsx (everything the sign-in page loads first),
   src/StaffApp.tsx, src/planner/PlannerPage.tsx, src/pages/Login.tsx ...

   Default keys: the application entry and the planner. For the module-level view (which source file pulled a library in)
   build with rollup-plugin-visualizer's `raw-data` template through a throw-away config; see design/perf/frontend-after.md.
   ══════════════════════════════════════════════════════════════ */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.BUDGET_DIST ? path.resolve(process.env.BUDGET_DIST) : path.join(root, 'dist');
const manifestPath = path.join(dist, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`chunk-report: ${manifestPath} is missing - run \`npm run build\` first`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const keys = process.argv.slice(2);
if (keys.length === 0) keys.push('src/web/appEntry.tsx', 'src/planner/PlannerPage.tsx');
const kb = (n) => `${(n / 1024).toFixed(1)}`.padStart(7);
const name = (key) => (manifest[key]?.file ?? key).replace('assets/', '');

for (const root_ of keys) {
  if (manifest[root_] === undefined) {
    console.error(`chunk-report: ${root_} is not in the manifest`);
    continue;
  }
  const seen = new Set();
  const rows = [];
  const visit = (key, via) => {
    if (seen.has(key) || manifest[key] === undefined) return;
    seen.add(key);
    const file = manifest[key].file;
    const raw = statSync(path.join(dist, file)).size;
    const br = brotliCompressSync(readFileSync(path.join(dist, file))).length;
    rows.push({ file: name(key), raw, br, via });
    for (const imported of manifest[key].imports ?? []) visit(imported, name(key));
  };
  visit(root_, '(root)');
  console.log(`\n${root_}: ${rows.length} scripts, ${(rows.reduce((s, r) => s + r.raw, 0) / 1024).toFixed(0)} kB raw, ${(rows.reduce((s, r) => s + r.br, 0) / 1024).toFixed(0)} kB brotli`);
  console.log('     raw kB     br kB  script                                      first imported by');
  for (const r of rows.sort((a, b) => b.br - a.br)) console.log(`${kb(r.raw)}  ${kb(r.br)}  ${r.file.padEnd(42)}  ${r.via}`);
}
