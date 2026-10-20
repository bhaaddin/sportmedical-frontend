import { describe, expect, it } from 'vitest';
import { DIST, DUR, EASE, POP_CURVE, POP_EASING, SETTLE_EASING, SPRING, STAGGER, cssEase, cssVariables, ms, springCurve, springEasing } from './tokens';

describe('motion tokens', () => {
  it('keeps the durations in order and the staff ceiling at 180 ms', () => {
    const order = [DUR.instant, DUR.quick, DUR.staffMax, DUR.base, DUR.slow, DUR.cinematic];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(DUR.staffMax).toBeLessThanOrEqual(0.18);
    expect(DUR.quick).toBeLessThan(DUR.staffMax);
  });

  it('writes easings as cubic-béziers a browser accepts', () => {
    for (const name of Object.keys(EASE) as (keyof typeof EASE)[]) {
      const [x1, , x2] = EASE[name];
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
      expect(cssEase(name)).toMatch(/^cubic-bezier\(-?[\d.]+, -?[\d.]+, -?[\d.]+, -?[\d.]+\)$/);
    }
    expect(cssEase('out')).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('formats milliseconds', () => {
    expect(ms(0.14)).toBe('140ms');
    expect(ms(1.1)).toBe('1100ms');
  });

  it('samples a spring into a CSS linear() easing that starts at 0, ends at 1 and overshoots when under-damped', () => {
    const easing = springEasing(SPRING.pop.stiffness, SPRING.pop.damping, SPRING.pop.mass);
    expect(easing).toBe(POP_EASING);
    const points = /^linear\((.*)\)$/.exec(easing)![1].split(', ').map(Number);
    expect(points.length).toBe(29);
    expect(points[0]).toBe(0);
    expect(points[points.length - 1]).toBe(1);
    expect(Math.max(...points)).toBeGreaterThan(1);
    expect(Math.max(...points)).toBeLessThan(1.25);
    // an over-damped spring never overshoots
    const heavy = /^linear\((.*)\)$/.exec(springEasing(200, 80, 1))![1].split(', ').map(Number);
    expect(Math.max(...heavy)).toBeLessThanOrEqual(1);
    expect(SETTLE_EASING).toMatch(/^linear\(/);
  });

  it('the spring is also an easing function that agrees with the CSS sampling', () => {
    const curve = springCurve(SPRING.pop.stiffness, SPRING.pop.damping, SPRING.pop.mass);
    expect(curve).toEqual(expect.any(Function));
    expect(POP_CURVE(0)).toBe(0);
    expect(POP_CURVE(1)).toBe(1);
    const points = /^linear\((.*)\)$/.exec(POP_EASING)![1].split(', ').map(Number);
    points.forEach((value, i) => expect(Math.abs(curve(i / (points.length - 1)) - value)).toBeLessThan(0.002));
    expect(Math.max(...points.map((_, i) => curve(i / 28)))).toBeGreaterThan(1);
  });

  it('exposes every token as a CSS variable', () => {
    const vars = cssVariables();
    expect(vars['--sm-dur-quick']).toBe('140ms');
    expect(vars['--sm-ease-pop']).toBe(POP_EASING);
    expect(Object.keys(vars).every((name) => name.startsWith('--sm-'))).toBe(true);
  });

  it('has sensible distances and staggers', () => {
    expect(DIST.press).toBeLessThan(1);
    expect(DIST.popFrom).toBeLessThan(1);
    expect(DIST.nudge).toBeLessThanOrEqual(8);
    expect(STAGGER.rows).toBeLessThan(STAGGER.items);
  });
});
