import { describe, expect, it } from 'vitest';
import { FORBIDDEN, GROUPS, chunkName, closure } from '../../scripts/bundle-budget.mjs';

describe('bundle budget helpers', () => {
  it('names a chunk without its hash', () => {
    expect(chunkName('assets/charts-BdwChCap.js')).toBe('charts');
    expect(chunkName('assets/heic-to-CuP2Qlsw.js')).toBe('heic-to');
    expect(chunkName('assets/useDemoDataSource-Dl_ChiPV.js')).toBe('useDemoDataSource');
  });

  it('follows static imports only, once, from several roots', () => {
    const manifest = {
      a: { file: 'assets/a-11111111.js', imports: ['shared', 'b'] },
      b: { file: 'assets/b-22222222.js', imports: ['shared'] },
      shared: { file: 'assets/shared-33333333.js' },
      lazy: { file: 'assets/lazy-44444444.js' },
    };
    expect(closure({ ...manifest, a: { ...manifest.a, dynamicImports: ['lazy'] } } as never, ['a'])).toEqual([
      'assets/a-11111111.js',
      'assets/shared-33333333.js',
      'assets/b-22222222.js',
    ]);
    expect(closure(manifest, ['b', 'a']).length).toBe(3);
  });

  it('forbids the heavy libraries in the first load of the application, the sign-in and the public site', () => {
    const forbidden = new Map(FORBIDDEN.map(([group, pattern]) => [group, pattern]));
    for (const group of ['app-entry', 'login', 'public-entry']) {
      expect(forbidden.get(group)?.test('charts')).toBe(true);
    }
    expect(forbidden.get('app-entry')?.test('heic-to')).toBe(true);
    expect(forbidden.get('app-entry')?.test('signalr')).toBe(true);
    expect(forbidden.get('planner')?.test('DemoDataSource')).toBe(true);
  });

  it('measures groups that exist', () => {
    const names = GROUPS.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(['app-entry', 'login', 'staff-portal', 'planner']));
  });
});
