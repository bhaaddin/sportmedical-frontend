/*
 * Turns the JSON of audit-all-routes.mjs / audit-popouts.mjs runs into the before/after tables of docs/stage3b-2026-10.md.
 *
 *   node scripts/stage3b/summarize.mjs --before-routes=a.json --after-routes=b.json --before-pop=c.json --after-pop=d.json
 */
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const load = (k) => (args[k] ? JSON.parse(readFileSync(args[k], 'utf8')) : null);

function routeTotals(rows, mode) {
  const ran = rows.filter((r) => !r.skipped && r.mode === mode);
  const sum = (f) => ran.reduce((a, r) => a + f(r), 0);
  return {
    routes: ran.length,
    darkRoutes: ran.filter((r) => r.darkFail).length,
    text: sum((r) => r.counts.text.failed),
    icon: sum((r) => r.counts.icon.failed),
    control: sum((r) => r.counts.control.failed),
    checked: sum((r) => r.counts.total),
    failingRoutes: ran.filter((r) => r.counts.failed > 0 || r.darkFail).length,
  };
}
const line = (label, t) => `| ${label} | ${t.routes} | ${t.checked} | ${t.darkRoutes} | ${t.text} | ${t.icon} | ${t.control} | ${t.failingRoutes} |`;

const out = [];
const br = load('before-routes');
const ar = load('after-routes');
if (br && ar) {
  out.push('| run | routes | measured items | routes with a large dark surface | text failures | icon failures | control failures | routes with any failure |', '|---|---|---|---|---|---|---|---|');
  for (const mode of ['light', 'dark']) {
    out.push(line(`${mode}, before (ef2fb0e)`, routeTotals(br, mode)));
    out.push(line(`${mode}, after`, routeTotals(ar, mode)));
  }
  const failing = ar.filter((r) => !r.skipped && r.mode === 'light' && (r.counts.failed > 0 || r.darkFail));
  out.push('', `Routes with a failure after (light): ${failing.length === 0 ? 'none' : failing.map((r) => r.route).join(', ')}`);
  const skipped = ar.filter((r) => r.skipped && r.mode === 'light');
  out.push(`Skipped: ${skipped.map((r) => `${r.route} (${r.skipped})`).join('; ') || 'none'}`);
  out.push('', '| route | before: dark % / text / icon / control | after: dark % / text / icon / control |', '|---|---|---|');
  const key = (r) => `${r.mode}|${r.route}`;
  const was = new Map(br.filter((r) => !r.skipped).map((r) => [key(r), r]));
  for (const r of ar.filter((x) => !x.skipped && x.mode === 'light')) {
    const b = was.get(key(r));
    const f = (x) => (x ? `${x.darkShare}% / ${x.counts.text.failed} / ${x.counts.icon.failed} / ${x.counts.control.failed}` : 'n/a');
    out.push(`| ${r.route} | ${f(b)} | ${f(r)} |`);
  }
}

const bp = load('before-pop');
const ap = load('after-pop');
if (bp && ap) {
  const tot = (rows, pred) => {
    const ran = rows.filter((r) => !r.skipped && pred(r));
    return { scenarios: ran.length, text: ran.reduce((a, r) => a + r.counts.text.failed, 0), icon: ran.reduce((a, r) => a + r.counts.icon.failed, 0), control: ran.reduce((a, r) => a + r.counts.control.failed, 0), checked: ran.reduce((a, r) => a + r.counts.total, 0), skipped: rows.filter((r) => r.skipped && pred(r)).length };
  };
  out.push('', '| pop-out run | scenario runs | measured items | text failures | icon failures | control failures | skipped |', '|---|---|---|---|---|---|---|');
  for (const mode of ['dark', 'light']) {
    for (const [label, rows, pred] of [['before (ef2fb0e + the DEV gallery), default accent', bp, (r) => r.mode === mode], ['after, default accent', ap, (r) => r.mode === mode && r.accent === 'forest'], ['after, all six accents', ap, (r) => r.mode === mode]]) {
      const t = tot(rows, pred);
      out.push(`| ${mode}, ${label} | ${t.scenarios} | ${t.checked} | ${t.text} | ${t.icon} | ${t.control} | ${t.skipped} |`);
    }
  }
  const bad = ap.filter((r) => !r.skipped && r.counts.failed > 0);
  out.push('', bad.length === 0 ? 'Pop-out failures after, any accent or mode: none.' : `Pop-out failures after: ${bad.map((r) => `${r.mode}/${r.accent}/${r.scenario}`).join(', ')}`);
}
console.log(out.join('\n'));
