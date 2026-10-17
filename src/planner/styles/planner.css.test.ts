/*
 * The generated stylesheet must not be able to reach the application (or the other way round).
 * Re-generate it with `node scripts/planner-scope-css.mjs` if this fails after editing the prototype.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'src', 'planner', 'styles');
const generated = postcss.parse(readFileSync(join(dir, 'planner.css'), 'utf8'));
const extras = postcss.parse(readFileSync(join(dir, 'planner.extras.css'), 'utf8'));

const inKeyframes = (rule: Rule): boolean => rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name);

describe.each([
  ['planner.css', generated],
  ['planner.extras.css', extras],
])('%s', (_name, root) => {
  it('puts every selector under .sm-planner', () => {
    const bad: string[] = [];
    root.walkRules((rule) => {
      if (inKeyframes(rule)) return;
      for (const selector of rule.selectors) {
        if (!selector.startsWith('.sm-planner')) bad.push(selector);
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it('prefixes every @keyframes', () => {
    const bad: string[] = [];
    root.walkAtRules(/keyframes$/i, (at) => { if (!at.params.startsWith('smp-')) bad.push(at.params); });
    expect(bad).toEqual([]);
  });
});

describe('planner.css', () => {
  it('has no pixel-mode, hotspot or reference-image rules left', () => {
    const bad: string[] = [];
    generated.walkRules((rule) => {
      if (/pixel-mode|hotspot|reference-image|for-pixel/.test(rule.selector)) bad.push(rule.selector);
    });
    expect(bad).toEqual([]);
  });
  it('keeps the root variables on .sm-planner and animates only prefixed keyframes', () => {
    const rootRule = generated.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === '.sm-planner');
    expect(rootRule?.toString()).toContain('--cyan:#00e6e4');
    const frames = new Set<string>();
    generated.walkAtRules(/keyframes$/i, (at) => { frames.add(at.params); });
    expect(frames.size).toBeGreaterThan(15);
    const unknown: string[] = [];
    generated.walkDecls(/^(-webkit-)?animation(-name)?$/i, (decl) => {
      for (const token of decl.value.split(/[\s,]+/)) {
        if (/^(smp-)/.test(token) && !frames.has(token)) unknown.push(token);
      }
    });
    expect(unknown).toEqual([]);
  });
  it('carries no embedded bitmap (the arrow art is a real file)', () => {
    const css = generated.toString();
    expect(css).not.toMatch(/data:image\/png;base64/);
    expect(css.length).toBeLessThan(400_000);
  });
});
