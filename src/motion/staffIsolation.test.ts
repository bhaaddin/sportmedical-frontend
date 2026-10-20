/*
 * The staff application never carries the public site's scroll machinery: no ScrollScene, no Lenis, no GSAP, no
 * shaders - not statically and not through anything it can lazy-load. (scripts/bundle-budget.mjs checks the same in
 * the built chunks; this one fails earlier, at the source, and names the file that crossed the line.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const FORBIDDEN_FILES = /src[\\/]motion[\\/](ScrollScene|LenisProvider|ShaderBackdrop|ShaderBackdropInner|gsapVendor|scrollBridge|scenes[\\/][^\\/]+)\.tsx?$/;
const FORBIDDEN_PACKAGES = /^(gsap|gsap\/.*|lenis|lenis\/.*|@paper-design\/.*)$/;

function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** Every source file reachable from `entry`; `dynamic` also follows import('...'). Returns file -> the file that imported it. */
function graph(entry: string, dynamic: boolean): Map<string, string> {
  const seen = new Map<string, string>([[entry, '(entry)']]);
  const queue = [entry];
  const staticImport = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  const dynamicImport = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (/\.test\.tsx?$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    const specifiers = [...text.matchAll(staticImport)].map((m) => m[1]);
    if (dynamic) specifiers.push(...[...text.matchAll(dynamicImport)].map((m) => m[1]));
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) {
        if (FORBIDDEN_PACKAGES.test(specifier)) seen.set(`package:${specifier}`, file);
        continue;
      }
      const target = resolveImport(file, specifier);
      if (target !== null && !seen.has(target)) {
        seen.set(target, file);
        queue.push(target);
      }
    }
  }
  return seen;
}

function offenders(entry: string, dynamic: boolean): string[] {
  const reached = graph(resolve(SRC, entry), dynamic);
  return [...reached.entries()]
    .filter(([file]) => FORBIDDEN_FILES.test(file) || file.startsWith('package:'))
    .map(([file, by]) => `${file.replace(SRC, 'src')}  <-  ${by.replace(SRC, 'src')}`);
}

describe('the staff application and the scroll machinery', () => {
  it('StaffApp (and every screen it can lazy-load) reaches no ScrollScene, Lenis, GSAP or shader', () => {
    expect(offenders('StaffApp.tsx', true)).toEqual([]);
  });

  it('the planner reaches none of them either', () => {
    expect(offenders('planner/PlannerPage.tsx', true)).toEqual([]);
    expect(offenders('planner/ClubPlannerPage.tsx', true)).toEqual([]);
  });

  it("the application's entry reaches none of them statically", () => {
    expect(offenders('web/appEntry.tsx', false)).toEqual([]);
  });

  it('the checker itself sees the public layout reach them (so the test is not vacuously green)', () => {
    const reached = offenders('web/WebLayout.tsx', false).join('\n');
    expect(reached).toMatch(/ScrollScene/);
    expect(reached).toMatch(/LenisProvider/);
  });
});
