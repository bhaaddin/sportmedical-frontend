/*
 * Every screen is at least compiled once.
 *
 * On 13. 9. 2026 this lane broke `ActivitiesPage.tsx` - a `{/* … *\/}` in a
 * ternary branch, where the position wants an expression - and reported
 * "typecheck clean, tests pass". Both were true. Measured with the break
 * deliberately reinstated:
 *
 *     tsc      exit=0   let it through
 *     vitest   exit=0   let it through
 *     build    exit=1   caught it
 *
 * `tsc` reads `{/* *\/}` as an object literal; the tests never touched that
 * file, and the one that mentions it reads it as raw text without compiling
 * it. The application was broken in the browser while two green checks said
 * otherwise. It was caught by opening the screen, which is not a thing that
 * happens on every change.
 *
 * A count at the time: 62 of 75 screens and booking components were never
 * imported by any test, so a parse error in any of them was invisible here.
 *
 * This is the cheapest possible guard and deliberately nothing more. It does
 * not render, click, or assert behaviour - it imports, which is enough to make
 * the bundler parse the file. Anything that does not parse throws here.
 */
import { describe, it, expect } from 'vitest';

/*
 * Left lazy on purpose: eager glob would import everything at module load, so
 * the first broken file would take the whole suite down with a message about
 * this file rather than about the screen that is broken.
 */
const modules = {
  ...import.meta.glob('./pages/**/*.tsx'),
  ...import.meta.glob('./components/booking/*.tsx'),
};

const paths = Object.keys(modules)
  .filter((p) => !p.includes('.test.'))
  .sort();

describe('every screen parses', () => {
  /* Guards the glob. A pattern that quietly matched nothing would leave the
     loop below empty and this file green forever, which is the same class of
     fault it exists to catch. */
  it('found the screens at all', () => {
    expect(paths.length).toBeGreaterThan(50);
    expect(paths).toContain('./pages/booking/ActivitiesPage.tsx');
  });

  /*
   * Generous, because the cost here is a cold transform, not a slow test -
   * one screen pulls enough behind it to take eight seconds the first time.
   * A tight limit would make this fail for a reason that is not the one it
   * is looking for, and a check that cries wolf gets deleted.
   */
  it.each(paths)('%s', async (path) => {
    const loaded = await modules[path]();
    expect(loaded).toBeTypeOf('object');
  }, 30_000);
});
