/* ══════════════════════════════════════════════════════════════
   WHAT A PRERENDERED PAGE MUST STILL BE, after the motion layer (docs/motion-kit.md)

   The public site is prerendered: its HTML is the page for a visitor without script, for a crawler and for the first
   paint. The motion kit may only ADD to it. `structureOf(html)` reads a page into the facts that must not move, and
   `compareWithBaseline` checks them against design/motion/prerender-baseline.json (taken from the build of claude/clean
   at b7e4405, before the kit): every heading and every word the page had is still there, there is still exactly one
   <h1>, and none of the kit's runtime state leaked into the markup (a hidden start state, a scene attribute).
   Pure string work: no DOM, usable by a vitest test (on the server render) and by scripts/prerender-check.mjs (on dist/).
   ══════════════════════════════════════════════════════════════ */

const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ');
const textOf = (fragment) => decode(fragment.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** The body's visible markup: scripts, styles and the inline SVG icons removed. */
function bodyMarkup(html) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
}

export function wordsOf(html) {
  const words = textOf(bodyMarkup(html)).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const bag = {};
  for (const word of words) bag[word] = (bag[word] ?? 0) + 1;
  return { total: words.length, bag };
}

export function structureOf(html) {
  const markup = bodyMarkup(html);
  const headings = [...markup.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `h${m[1]}:${textOf(m[2])}`);
  const { total, bag } = wordsOf(html);
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  const bootAt = head.indexOf('data-sm-motion');
  const firstStyleAt = Math.min(...['<style', 'rel="stylesheet"'].map((marker) => (head.indexOf(marker) === -1 ? Infinity : head.indexOf(marker))));
  const leaks = [];
  // Runtime state of the motion layer must never be baked into the server markup.
  if (/\sdata-scene=/.test(html)) leaks.push('data-scene attribute');
  if (/\sdata-stage=/.test(html)) leaks.push('data-stage attribute');
  if (/<[^>]+style="[^"]*opacity:\s*0[;"]/i.test(markup)) leaks.push('inline opacity:0 (a hidden start state)');
  if (/<[^>]+style="[^"]*clip-path/i.test(markup)) leaks.push('inline clip-path');
  if (/<[^>]+style="[^"]*transform:\s*(?!none)/i.test(markup)) leaks.push('inline transform');
  if (/class="[^"]*\blenis\b/.test(html.slice(0, html.indexOf('<body')))) leaks.push('lenis class on <html>');
  return {
    prerendered: html.includes('data-prerendered'),
    h1Count: (markup.match(/<h1\b/gi) ?? []).length,
    headings,
    totalWords: total,
    words: bag,
    snapshot: html.includes('window.__SM_WEB__='),
    bootScript: bootAt !== -1,
    bootBeforeStyles: bootAt !== -1 && bootAt < firstStyleAt,
    leaks,
  };
}

/** Facts to keep in the baseline file (the word bag as unique sorted words + the total). */
export function baselineEntry(structure) {
  return { headings: structure.headings, totalWords: structure.totalWords, words: Object.keys(structure.words).sort() };
}

/** Problems of `structure` against one baseline entry; [] when the page is still what it was. */
export function compareWithBaseline(path, structure, baseline) {
  const problems = [];
  if (!structure.prerendered) problems.push(`${path}: not marked data-prerendered`);
  if (structure.h1Count !== 1) problems.push(`${path}: ${structure.h1Count} <h1> (must be exactly one)`);
  if (!structure.snapshot) problems.push(`${path}: the data snapshot window.__SM_WEB__ is missing`);
  const have = [...structure.headings].sort();
  const missing = [...baseline.headings].sort().filter((h) => {
    const at = have.indexOf(h);
    if (at === -1) return true;
    have.splice(at, 1);
    return false;
  });
  if (missing.length > 0) problems.push(`${path}: headings lost: ${missing.join(' | ')}`);
  const lostWords = baseline.words.filter((word) => structure.words[word] === undefined);
  if (lostWords.length > 0) problems.push(`${path}: words lost: ${lostWords.slice(0, 12).join(', ')}${lostWords.length > 12 ? ` (+${lostWords.length - 12})` : ''}`);
  if (structure.totalWords < baseline.totalWords * 0.97) problems.push(`${path}: ${structure.totalWords} words now, ${baseline.totalWords} before`);
  for (const leak of structure.leaks) problems.push(`${path}: motion state leaked into the HTML: ${leak}`);
  return problems;
}
