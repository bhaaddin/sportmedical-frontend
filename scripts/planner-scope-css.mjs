/*
 * Mechanical port of the prototype's stylesheet.
 *
 *     node scripts/planner-scope-css.mjs
 *
 * Reads design/planner-v65.html, takes its <style> block and writes
 *
 *     src/planner/styles/planner.css          scoped stylesheet
 *     src/planner/assets/crystal-arrow.png    the carousel arrow art (was a base64 string in the JS)
 *
 * What it does, in this order (nothing is edited by hand):
 *   1. `:root`, `html`, `body` rules  ->  `.sm-planner`  (the planner root is the "page")
 *   2. every other selector           ->  `.sm-planner <selector>`  (a universal `*` also keeps `.sm-planner`)
 *   3. `@keyframes NAME`              ->  `@keyframes smp-NAME`, and every `animation` / `animation-name`
 *                                         that uses NAME follows
 *   4. rules for the prototype's pixel mode (reference image, #hotspots, .hotspot, .pixel-mode, .for-pixel)
 *      are dropped; a selector list keeps its other selectors
 *   5. `@property` registrations stay (the spec makes them global); the script FAILS if the application
 *      outside src/planner uses one of the registered names
 *   6. the `crystalArrowArt` data URI of the script is decoded into the PNG above
 *   7. every accent-chrome colour (bright cyan / aqua / teal: `isAccentChrome` in src/accent.ts) is wrapped as
 *      `hsl(from <the prototype's colour> var(--sm-hsl, h s l))`. Without `--sm-hsl` the fallback `h s l` is the
 *      identity, so the default accent paints the prototype's own colours; the staff app sets `--sm-hsl` from the
 *      picked accent (AccentRootVars) and the whole stage follows it. Navy surfaces, near-white text and the
 *      semantic tones are not accent chrome and stay as written.
 *
 * The scoping means the application cannot reach into the planner and the planner cannot leak into
 * the application. Re-run only when design/planner-v65.html changes.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { wrapCssColors } from '../src/accent.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'design', 'planner-v65.html'), 'utf8');
const SCOPE = '.sm-planner';
const PREFIX = 'smp-';

const styleMatch = /<style>([\s\S]*?)<\/style>/.exec(html);
if (!styleMatch) throw new Error('No <style> block found.');
const css = styleMatch[1];

/* ------------------------------ helpers ------------------------------ */

const DROP = [/\.reference-image/, /#hotspots/, /\.hotspot/, /\.pixel-mode/, /\.for-pixel/];
const shouldDrop = (selector) => DROP.some((re) => re.test(selector));

function scopeSelector(selector) {
  const s = selector.trim();
  if (s === ':root' || s === 'html' || s === 'body' || s === 'html,body') return [SCOPE];
  if (/^(html|body)\b/.test(s)) {
    throw new Error(`Unhandled root-relative selector: ${s}`);
  }
  if (s === '*') return [SCOPE, `${SCOPE} *`];
  if (s === '*::before' || s === '*::after') return [`${SCOPE} ${s}`];
  return [`${SCOPE} ${s}`];
}

const isKeyframes = (node) => node?.type === 'atrule' && /keyframes$/i.test(node.name);

/* ------------------------------ transform ------------------------------ */

const ast = postcss.parse(css);

// 1. keyframes names
const frameNames = new Set();
ast.walkAtRules(/keyframes$/i, (rule) => frameNames.add(rule.params.trim()));

const stats = { rules: 0, dropped: 0, droppedSelectors: 0, keyframes: frameNames.size, properties: [] };

ast.walkRules((rule) => {
  if (isKeyframes(rule.parent)) return; // from / to / 50%
  const kept = [];
  for (const selector of rule.selectors) {
    /*
     * The prototype has a stray ".fx-voltage.is-firing" with no body right in front of "@keyframes electricDrift{…}"
     * (line ~1759), which the CSS parser reads as ONE rule whose selector contains "@keyframes". A browser throws an
     * invalid selector away - so in the file as delivered that rule and its keyframes never applied - but the production
     * minifier (lightningcss) refuses it. Dropping it here reproduces exactly what the file does in a browser.
     */
    if (selector.includes('@')) {
      stats.droppedSelectors++;
      continue;
    }
    if (shouldDrop(selector)) {
      stats.droppedSelectors++;
      continue;
    }
    for (const scoped of scopeSelector(selector)) if (!kept.includes(scoped)) kept.push(scoped);
  }
  if (!kept.length) {
    rule.remove();
    stats.dropped++;
    return;
  }
  rule.selectors = kept;
  stats.rules++;
});

// Rules that ended up empty (e.g. a media block with only dropped rules)
ast.walkAtRules((at) => {
  if (at.nodes && at.nodes.length === 0 && !/^(font-face|property)$/i.test(at.name)) at.remove();
});

// 2. rename keyframes and follow in animation declarations
ast.walkAtRules(/keyframes$/i, (rule) => {
  rule.params = PREFIX + rule.params.trim();
});
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
ast.walkDecls(/^(-webkit-)?animation(-name)?$/i, (decl) => {
  let value = decl.value;
  for (const name of frameNames) {
    value = value.replace(new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, 'g'), PREFIX + name);
  }
  decl.value = value;
});

// 3. @property: global by spec - make sure the application does not use the names
ast.walkAtRules('property', (at) => stats.properties.push(at.params.trim()));
function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full.includes(join('src', 'planner'))) continue;
      yield* sourceFiles(full);
    } else if (/\.(ts|tsx|css)$/.test(entry)) yield full;
  }
}
for (const file of sourceFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const name of stats.properties) {
    if (text.includes(name)) throw new Error(`${file} uses the custom property ${name}, which planner.css registers globally with @property.`);
  }
}

const banner = `/*
 * GENERATED by scripts/planner-scope-css.mjs from design/planner-v65.html - do not edit by hand.
 *
 * Every selector sits under .sm-planner; :root/html/body rules live on .sm-planner;
 * @keyframes are prefixed "${PREFIX}"; the prototype's pixel-mode / hotspot / reference-image
 * rules are removed. Re-generate:  node scripts/planner-scope-css.mjs
 */
`;
mkdirSync(join(root, 'src', 'planner', 'styles'), { recursive: true });
/*
 * 7. accent colours. The prototype's semantic palette variables (--green, --blue, --purple, --amber, --red) are statuses,
 *    not the accent: --green (#00e5c6) sits in the cyan hue range but must stay a status colour.
 */
const SEMANTIC_PROPS = /^--(green|blue|purple|amber|red)$/;
stats.accentWrapped = 0;
ast.walkDecls((decl) => {
  if (SEMANTIC_PROPS.test(decl.prop)) return;
  const { css: value, wrapped } = wrapCssColors(decl.value);
  if (wrapped > 0) {
    decl.value = value;
    stats.accentWrapped += wrapped;
  }
});
const out = banner + ast.toResult().css.replace(/\n{3,}/g, '\n\n').trim() + '\n';
writeFileSync(join(root, 'src', 'planner', 'styles', 'planner.css'), out, 'utf8');

/* ------------------------------ the arrow art ------------------------------ */

const art = /const crystalArrowArt = 'data:image\/png;base64,([A-Za-z0-9+/=]+)'/.exec(html);
if (!art) throw new Error('crystalArrowArt not found in the script.');
mkdirSync(join(root, 'src', 'planner', 'assets'), { recursive: true });
const png = Buffer.from(art[1], 'base64');
writeFileSync(join(root, 'src', 'planner', 'assets', 'crystal-arrow.png'), png);

console.log(
  `planner.css: ${stats.rules} rules scoped, ${stats.dropped} rules + ${stats.droppedSelectors} selectors dropped, ` +
    `${stats.keyframes} keyframes renamed, @property ${stats.properties.join(', ')}; ${(out.length / 1024).toFixed(0)} kB. ` +
    `crystal-arrow.png ${(png.length / 1024).toFixed(0)} kB. ${stats.accentWrapped} accent colours follow --sm-hsl.`,
);
