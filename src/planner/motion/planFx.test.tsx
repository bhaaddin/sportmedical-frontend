/*
 * The planner's motion contract: it answers actions, it honours the setting (plné / omezené / vypnuto) and it never
 * writes a transform of its own.
 */
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanFxHost, REFUSE_MS } from './PlanFxHost';
import { FRESH_MS, planFx, wasJustWritten } from './planFx';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-motion');
});

describe('planFx events', () => {
  it('a card that mounts right after a write is fresh; one that mounts later is not', async () => {
    planFx.wrote();
    expect(wasJustWritten()).toBe(true);
    const realNow = Date.now;
    Date.now = () => realNow() + FRESH_MS + 50;
    try {
      expect(wasJustWritten()).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });

  it('a pick remembers its days in the order they were taken', () => {
    planFx.picked(['2026-10-22', '2026-10-23']);
    expect(planFx.get().picked.dates).toEqual(['2026-10-22', '2026-10-23']);
    const token = planFx.get().picked.token;
    planFx.picked(['2026-10-26']);
    expect(planFx.get().picked.token).toBe(token + 1);
  });
});

describe('PlanFxHost', () => {
  it('a refusal marks the planner root for a moment, then clears it again', async () => {
    const root = document.createElement('div');
    root.className = 'sm-planner';
    document.body.appendChild(root);
    render(<PlanFxHost />);
    expect(root.hasAttribute('data-refuse')).toBe(false);
    await act(async () => {
      planFx.refuse();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(root.hasAttribute('data-refuse')).toBe(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, REFUSE_MS + 80));
    });
    expect(root.hasAttribute('data-refuse')).toBe(false);
    root.remove();
  });
});

describe('planner.fx.css', () => {
  const css = postcss.parse(readFileSync(join(__dirname, '..', 'styles', 'planner.fx.css'), 'utf8'));

  it('every rule is keyed on html[data-motion] - nothing moves without the setting', () => {
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /keyframes/.test((rule.parent as postcss.AtRule).name)) return;
      expect(rule.selector, rule.selector).toMatch(/html\[data-motion='(full|reduced)'\]/);
    });
  });

  it('"omezené" never travels: its rules only fade or flash', () => {
    css.walkRules(/html\[data-motion='reduced'\]/, (rule) => {
      rule.walkDecls((d) => {
        if (d.prop === 'animation') expect(d.value, rule.selector).toMatch(/plan-(fade-in|flash)/);
        expect(['transform', 'translate', 'scale'].includes(d.prop), `${rule.selector} ${d.prop}`).toBe(false);
      });
    });
  });

  it('animates only compositor properties (transform / translate / opacity / box-shadow): no layout shift', () => {
    css.walkAtRules(/keyframes/, (at) => {
      at.walkDecls((d) => {
        expect(['opacity', 'transform', 'translate', 'box-shadow'].includes(d.prop), `${at.params} ${d.prop}`).toBe(true);
      });
    });
  });
});
