/*
 * "Zobrazit na webu" links to the public page a slot lives on. The table is derived from the one
 * list of public addresses (src/web/sitePaths.ts), so the admin does not import every public page
 * component; this keeps it in step with src/web/routes.ts, and with the move of the site to the
 * root of the domain.
 */
import { describe, it, expect } from 'vitest';
import { WEB_ROUTES } from '../../../web/routes';
import { SLOTS_BY_PAGE } from '../../../site/siteSlots';
import { PUBLIC_PATHS } from './publicPaths';
import { PUBLIC_PATHS as REEXPORTED, buildPages } from './model';

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

  it('sends the landing page and the shared texts to "/", and no path starts with /web', () => {
    expect(PUBLIC_PATHS.landing).toBe('/');
    expect(PUBLIC_PATHS.spolecne).toBe('/');
    expect(PUBLIC_PATHS.sluzby).toBe('/sluzby');
    expect(PUBLIC_PATHS.onas).toBe('/o-nas');
    for (const path of Object.values(PUBLIC_PATHS)) expect(path).not.toMatch(/^\/web(?:\/|$)/);
  });

  it('is the same table the admin screen reads, and every page it lists points at a public address', () => {
    expect(REEXPORTED).toBe(PUBLIC_PATHS);
    const real = new Set(WEB_ROUTES.map((r) => r.path));
    for (const page of buildPages()) {
      if (page.path !== undefined) expect(real.has(page.path), `${page.id} → ${page.path}`).toBe(true);
    }
  });
});
