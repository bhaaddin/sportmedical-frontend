import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The prototype has a stray, bodiless ".fx-voltage.is-firing" in front of an "@keyframes" (browsers drop it, the
 * production minifier refuses it: "Invalid dangling combinator in selector" broke `vite build`). The scoping script
 * drops any selector that contains an at-rule; this pins the generated file so a regeneration cannot bring it back.
 */
/* The path from the project root (vitest runs there): `import.meta.url` is not a file URL in the jsdom environment. */
const css = readFileSync(resolve(process.cwd(), 'src/planner/styles/planner.css'), 'utf8');

describe('the generated planner.css is valid for the production minifier', () => {
  it('has no selector that swallows an at-rule', () => {
    expect(css).not.toMatch(/\.sm-planner[^{};@]*\s@keyframes/);
  });

  it('has no keyframe step ("from", "to") carrying the scope prefix', () => {
    expect(css).not.toMatch(/\.sm-planner\s+(from|to)\s*\{/);
  });
});
