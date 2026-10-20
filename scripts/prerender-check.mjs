/*
 * Is every prerendered page still what it was before the motion kit? (the check is scripts/prerender-structure-lib.mjs)
 *
 *     node scripts/prerender-check.mjs                       # checks dist/ against design/motion/prerender-baseline.json
 *     node scripts/prerender-check.mjs --write-baseline DIR  # (re)writes the baseline from a build in DIR (one-off)
 *     env: DIST=<folder>
 *
 * Besides the baseline comparison it asserts, for each page of dist/: the motion boot script is in <head> before the
 * first style (so <html data-motion> is set before the first paint), and the page's own HTML carries no scene state.
 * Exit 1 on any problem.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineEntry, compareWithBaseline, structureOf } from './prerender-structure-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'design', 'motion', 'prerender-baseline.json');

/** Every prerendered page under `dist`: '/' -> index.html, '/cenik' -> cenik/index.html, ... (app.html is the SPA shell). */
function pagesOf(dist) {
  const pages = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) {
        if (name === 'assets' || name === '.vite') continue;
        walk(file);
      } else if (name === 'index.html') {
        const html = readFileSync(file, 'utf8');
        if (!html.includes('data-prerendered')) continue;
        const rel = relative(dist, dirname(file)).replace(/\\/g, '/');
        pages[rel === '' ? '/' : `/${rel}`] = html;
      }
    }
  };
  walk(dist);
  return pages;
}

const args = process.argv.slice(2);
if (args[0] === '--write-baseline') {
  const pages = pagesOf(resolve(args[1]));
  const baseline = {};
  for (const [path, html] of Object.entries(pages).sort(([a], [b]) => a.localeCompare(b))) baseline[path] = baselineEntry(structureOf(html));
  writeFileSync(BASELINE, `${JSON.stringify({ note: 'Headings and words of every prerendered page before the motion kit (claude/clean b7e4405, PRERENDER_API_URL=off).', pages: baseline })}\n`);
  console.log(`prerender-check: wrote ${Object.keys(baseline).length} pages to ${relative(root, BASELINE)}`);
  process.exit(0);
}

const dist = resolve(process.env.DIST ?? join(root, 'dist'));
if (!existsSync(dist)) {
  console.error(`prerender-check: ${dist} does not exist - run \`npm run build\` first`);
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).pages;
const pages = pagesOf(dist);
const problems = [];
for (const path of Object.keys(baseline)) {
  const html = pages[path];
  if (html === undefined) {
    problems.push(`${path}: no prerendered page in ${relative(root, dist)}`);
    continue;
  }
  const structure = structureOf(html);
  problems.push(...compareWithBaseline(path, structure, baseline[path]));
  if (!structure.bootScript) problems.push(`${path}: the motion boot script (data-sm-motion) is missing from <head>`);
  else if (!structure.bootBeforeStyles) problems.push(`${path}: the motion boot script comes after the first style (the first paint would not know the setting)`);
}
for (const path of Object.keys(pages)) if (baseline[path] === undefined) problems.push(`${path}: a prerendered page that is not in the baseline`);

if (problems.length > 0) {
  console.error('prerender-check FAILED:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`prerender-check: ${Object.keys(baseline).length} pages - every heading and word of the baseline is present, one <h1> each, boot script first, no motion state in the HTML`);
