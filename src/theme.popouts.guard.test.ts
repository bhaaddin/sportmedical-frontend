/*
 * R5 guard: a pop-out component (a file that opens a Dialog, Popover, Menu, Snackbar, Drawer, Tooltip, Autocomplete or Popper) must
 * not paint with a colour of its own. The surface comes from the theme (palette / `popoutTokens` / `--sm-pop-*` / `TONE_CSS`), so it
 * is right in dark, light and every accent; a literal `#FFFFFF` on a pop-out is exactly how "the Upravit klub dialog was white on a
 * dark app" and "white text on the cyan button" happened.
 *
 * What is NOT checked: generated stylesheets (planner.css and its light twin; see planner.light.test.ts), the public site and the
 * portals (their own themes), the DEV galleries, and the allow-list below - each entry says why a literal there is not a theme
 * colour (a print window, a hand-set category colour, data a person can change).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const POPOUT = /<(Dialog|Popover|Menu|Snackbar|Drawer|Tooltip|Autocomplete|Popper)\b/;
const EXCLUDED_DIRS = ['web', 'pages/public', 'components/public', 'motion/lab', 'dev', 'planner/styles'];
const LITERAL = /(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|'white'|'black'|"white"|"black")/g;

/** file (relative to src, forward slashes) -> number of literals allowed, with the reason. */
const ALLOW: Record<string, { count: number; why: string }> = {
  'components/booking/ClubScheduleReport.tsx': { count: 6, why: 'the CSS of a printed report window: paper is white by definition' },
  'planner/components/board/BoardSurface.tsx': { count: 3, why: 'the lunch default colour (data a person can change) and the prototype ghost tone passed through accentLiteral' },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = walk(SRC)
  .map((f) => ({ full: f, rel: relative(SRC, f).split(sep).join('/') }))
  .filter(({ rel }) => !EXCLUDED_DIRS.some((d) => rel.startsWith(`${d}/`)));

const popouts = files.filter(({ full }) => POPOUT.test(readFileSync(full, 'utf8')));

describe('pop-out components take their colours from the theme', () => {
  it('finds the pop-out components (the scan is not vacuous)', () => {
    expect(popouts.length).toBeGreaterThan(60);
  });

  it.each(popouts.map((f) => [f.rel, f.full] as const))('%s has no colour literal outside the allow-list', (rel, full) => {
    const text = stripComments(readFileSync(full, 'utf8'));
    const found = text.match(LITERAL) ?? [];
    const allowed = ALLOW[rel]?.count ?? 0;
    expect(found, `${rel}: ${found.join(', ')} - use the theme (palette / popoutTokens / --sm-pop-* / TONE_CSS) or add an allow-list entry with a reason`).toHaveLength(allowed);
  });

  it('the allow-list has no stale entry', () => {
    for (const rel of Object.keys(ALLOW)) {
      const text = stripComments(readFileSync(join(SRC, rel), 'utf8'));
      expect((text.match(LITERAL) ?? []).length, `${rel} no longer holds the literals the allow-list expects`).toBe(ALLOW[rel].count);
    }
  });
});
