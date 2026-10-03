/*
 * "Zobrazit na webu" links to the public page a slot lives on. The table is ours (so the admin
 * does not import every public page component); this keeps it in step with src/web/routes.ts.
 */
import { describe, it, expect } from 'vitest';
import { WEB_ROUTES } from '../../../web/routes';
import { SLOTS_BY_PAGE } from '../../../site/siteSlots';
import { PUBLIC_PATHS } from './model';

describe('PUBLIC_PATHS', () => {
  it('has the path of every public route, under its id', () => {
    for (const route of WEB_ROUTES) expect(PUBLIC_PATHS[route.id], route.id).toBe(route.path);
  });

  it('has a path for every registry page, and every path is a real public route', () => {
    const real = new Set(WEB_ROUTES.map((r) => r.path));
    for (const id of Object.keys(SLOTS_BY_PAGE)) {
      expect(PUBLIC_PATHS[id], id).toBeDefined();
      expect(real.has(PUBLIC_PATHS[id]), `${id} → ${PUBLIC_PATHS[id]}`).toBe(true);
    }
  });
});
