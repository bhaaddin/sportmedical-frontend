/*
 * The standard calendar's slim top bar and the room it gives back. jsdom has no layout engine, so the geometry is checked where it is
 * written: the numbers are read out of the stylesheets (planner.css, planner.extras.css, planner.fluid.css), the CSS arithmetic
 * (`calc()`, `var()`) is evaluated at the stage sizes `fitStage` gives for real window sizes, and what comes out must be
 *
 *   - a bar of 48-52 design px at the file's position (left 25, top 8, right 48),
 *   - the sidebar and the board starting 7 px under it - the file's own gap between its header and its panels,
 *   - both ending where they ended before (35 / 36 px above the stage's bottom: nothing is left over, nothing is cut),
 *   - 90 px taller than with the 140 px card, so the 12 hour rows of the board are 7.5 design px taller each.
 *
 * The real pixels at 390x844 ... 2560x1440 are measured in Chromium by `scripts/slim-header-check.mjs`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type Declaration, type Root, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { fitStage } from '../components/PlannerMetrics';

const dir = join(process.cwd(), 'src', 'planner', 'styles');
const parse = (name: string) => postcss.parse(readFileSync(join(dir, name), 'utf8'));
const generated = parse('planner.css');
const extras = parse('planner.extras.css');
const fluid = parse('planner.fluid.css');
const compact = parse('planner.compact.css');

/** The declarations of the rules that have exactly this selector (a comma list is matched by any member). */
function declsOf(root: Root, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  root.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((d: Declaration) => {
      out.set(d.prop, d.value.replace(/\s*!important\s*$/, ''));
    });
  });
  return out;
}
const must = (map: Map<string, string>, prop: string): string => {
  const v = map.get(prop);
  if (v === undefined) throw new Error(`no ${prop}`);
  return v;
};

/** `calc(var(--stage-h, 941px) - var(--slim-top) - 36px)` with the custom properties of `vars` -> a number of px. */
function evalPx(value: string, vars: Record<string, string>): number {
  let v = value.trim();
  for (let guard = 0; guard < 20 && /var\(/.test(v); guard += 1) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_m, name: string, fallback?: string) => vars[name] ?? fallback ?? 'NaN');
  }
  const expr = v.replace(/calc/g, '').replace(/px/g, '');
  if (!/^[\d\s.+\-*/()]+$/.test(expr)) throw new Error(`cannot evaluate ${value} -> ${expr}`);
  return Function(`"use strict"; return (${expr});`)() as number;
}
/** Resolve the custom properties of a rule in order (each may use the ones before it). */
function resolveVars(map: Map<string, string>, base: Record<string, string>): Record<string, string> {
  const vars = { ...base };
  for (const [prop, value] of map) if (prop.startsWith('--')) vars[prop] = `${evalPx(value, vars)}px`;
  return vars;
}

const SLIM = '#club-unified-header.is-slim';
const ROOT = `.sm-planner[data-layout='desktop']:has(${SLIM})`;
const ROOT_STANDARD = `${ROOT}:has(.planner[data-layout='standard'])`;
const SIDEBAR = `${ROOT} #dashboard.live-mode .sidebar`;

describe('the slim bar and the panels under it (desktop stage)', () => {
  /* the file */
  const fileHeader = declsOf(generated, '.sm-planner #dashboard .club-unified-header');
  const fileSidebar = declsOf(generated, '.sm-planner .sidebar');
  const barTop = parseFloat(must(fileHeader, 'top'));
  const fileHeaderHeight = parseFloat(must(fileHeader, 'height'));
  const fileTop = parseFloat(must(fileSidebar, 'top'));
  const fileGap = fileTop - (barTop + fileHeaderHeight);

  it('reads the file as 8 / 140 / 155: a 7 px gap under the header', () => {
    expect([barTop, fileHeaderHeight, fileTop, fileGap]).toEqual([8, 140, 155, 7]);
  });

  const vars = declsOf(fluid, ROOT);
  const standardVars = declsOf(fluid, ROOT_STANDARD);
  const sidebar = declsOf(fluid, SIDEBAR);
  const slimRule = declsOf(extras, '.sm-planner #dashboard.live-mode .club-unified-header.is-slim');

  it('declares the bar at 48-52 design px, 8 from the top, with the file gap of 7 px, and starts the panels right under it', () => {
    const v = resolveVars(vars, { '--stage-h': '941px' });
    const barH = evalPx('var(--slim-bar-h, 50px)', v);
    expect(barH).toBeGreaterThanOrEqual(48);
    expect(barH).toBeLessThanOrEqual(52);
    expect(evalPx(must(slimRule, 'height'), v)).toBe(barH);
    expect(evalPx('var(--slim-bar-top)', v)).toBe(barTop);
    expect(evalPx('var(--slim-gap)', v)).toBe(fileGap);
    expect(evalPx('var(--slim-top)', v)).toBe(barTop + barH + fileGap);
    expect(evalPx('var(--v18-planner-top)', v)).toBe(barTop + barH + fileGap);
    expect(evalPx(must(sidebar, 'top'), v)).toBe(barTop + barH + fileGap);
  });

  const windows: Array<[string, number, number]> = [
    ['1280x720', 1280, 720],
    ['1440x900', 1440, 900],
    ['1920x1080', 1920, 1080],
    ['2560x1440', 2560, 1440],
    ['1672x941 (the file)', 1672, 941],
    ['1366x600 (a low laptop)', 1366, 600],
    ['3440x1440 (ultra-wide)', 3440, 1440],
  ];
  describe.each(windows)('%s', (_label, width, height) => {
    const stage = fitStage(width, height);
    const base = { '--stage-w': `${stage.width}px`, '--stage-h': `${stage.height}px` };
    const v = resolveVars(vars, base);
    const vStandard = resolveVars(standardVars, v);
    const barH = evalPx('var(--slim-bar-h)', v);
    const top = evalPx('var(--slim-top)', v);
    const sidebarH = evalPx(must(sidebar, 'height'), v);
    const boardH = evalPx('var(--v18-planner-height)', vStandard);

    it('starts the sidebar and the board 7 px under the bar', () => {
      expect(evalPx(must(sidebar, 'top'), v) - (barTop + barH)).toBe(7);
      expect(evalPx('var(--v18-planner-top)', vStandard) - (barTop + barH)).toBe(7);
    });
    it('fills down to where the file ends: 35 px (sidebar) / 36 px (board) above the stage bottom - no gap, nothing cut', () => {
      expect(top + sidebarH).toBeCloseTo(stage.height - 35, 6);
      expect(top + boardH).toBeCloseTo(stage.height - 36, 6);
      expect(boardH).toBeGreaterThan(0);
    });
    it('is exactly 90 design px taller than under the 140 px card, so the hour rows grow by 7.5 px each', () => {
      expect(sidebarH - (stage.height - 190)).toBeCloseTo(90, 6);
      expect(boardH - (stage.height - 191)).toBeCloseTo(90, 6);
      expect(90 / 12).toBe(7.5);
    });
    it('is as wide as the file header: left 25, right 48', () => {
      const headerW = evalPx('calc(var(--stage-w, 1672px) - 73px)', v);
      expect(25 + headerW + 48).toBeCloseTo(stage.width, 6);
    });
  });

  it('keeps the 210 px reserve of the deck where a club deck is drawn under the slim bar', () => {
    const v = resolveVars(vars, { '--stage-h': '941px' });
    expect(evalPx('var(--v18-planner-height)', v)).toBe(941 - 65 - 210);
  });
});

describe('the compact layouts', () => {
  it('phone: the board body takes the 31 px the card gave back (K 330 -> 299)', () => {
    const rule = declsOf(compact, `.sm-planner[data-layout='phone']:has(${SLIM}) .planner .board-body`);
    expect(rule.get('max-height')).toBe('clamp(360px, calc(100dvh - 299px), 900px)');
  });
  it('tablet: the board fills what is left under the bar (no fixed height, minimum 360 px)', () => {
    const body = declsOf(compact, `.sm-planner[data-layout='tablet']:has(${SLIM}) #dashboard.live-mode .planner .week-board > .board-body`);
    expect(body.get('flex')).toBe('1 1 0');
    expect(body.get('height')).toBe('auto');
    expect(body.get('min-height')).toBe('360px');
    expect(body.get('max-height')).toBe('none');
  });
  it('removes no rule of the generated stylesheet: the card rules are still there for the club banner', () => {
    expect(declsOf(generated, '.sm-planner #dashboard .club-unified-header').get('height')).toContain('140px');
  });
});
