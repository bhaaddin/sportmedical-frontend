import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

/*
 * The prototype has a stray, bodiless ".fx-voltage.is-firing" in front of an "@keyframes" (browsers drop it, the
 * production minifier refuses it: "Invalid dangling combinator in selector" broke `vite build`). The scoping script
 * drops any selector that contains an at-rule; this pins the generated file so a regeneration cannot bring it back.
 */
const css = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8');

describe('the generated planner.css is valid for the production minifier', () => {
  it('has no selector that swallows an at-rule', () => {
    expect(css).not.toMatch(/\.sm-planner[^{};@]*\s@keyframes/);
  });

  it('has no keyframe step ("from", "to") carrying the scope prefix', () => {
    expect(css).not.toMatch(/\.sm-planner\s+(from|to)\s*\{/);
  });
});
