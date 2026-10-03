import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOT_FOUND_META, WEB_ROUTES, findWebRoute, normalizeWebPath, routeOutputFile } from './routes';
import { SLOTS_BY_PAGE } from '../site/siteSlots';

const PATHS = [
  '/web', '/web/sluzby', '/web/prohlidky', '/web/diagnostika', '/web/inbody',
  '/web/cenik', '/web/dokumenty', '/web/kontakt', '/web/o-nas', '/web/kluby',
];

describe('the route table of the public site', () => {
  it('lists exactly the ten pages of decision 17, in order', () => {
    expect(WEB_ROUTES.map((route) => route.path)).toEqual(PATHS);
  });

  it('gives every route an id, a label, a title, a description and a component', () => {
    expect(new Set(WEB_ROUTES.map((r) => r.id)).size).toBe(WEB_ROUTES.length);
    for (const route of WEB_ROUTES) {
      expect(route.label).not.toBe('');
      expect(route.title).toContain('SportMedical Diagnostics');
      expect(route.description.length).toBeGreaterThan(30);
      expect(route.description.length).toBeLessThanOrEqual(200);
      expect(typeof route.Component).toBe('function');
      expect(route.path).toMatch(/^\/web(\/[a-z-]+)?$/);
    }
    expect(NOT_FOUND_META.title).toContain('nenalezena');
  });

  it('has a slots file for every page', () => {
    for (const route of WEB_ROUTES) {
      const key = route.id === 'landing' ? 'landing' : route.id;
      expect(Object.keys(SLOTS_BY_PAGE)).toContain(key);
    }
  });

  it('finds a route from any url shape the browser can send', () => {
    expect(findWebRoute('/web')?.id).toBe('landing');
    expect(findWebRoute('/web/')?.id).toBe('landing');
    expect(findWebRoute('/web/cenik/?utm=1#x')?.id).toBe('cenik');
    expect(findWebRoute('/web/o-nas')?.id).toBe('onas');
    expect(findWebRoute('/web/neexistuje')).toBeUndefined();
    expect(findWebRoute('/objednat')).toBeUndefined();
    expect(normalizeWebPath('/web/kluby///')).toBe('/web/kluby');
  });

  it('writes each page to dist/web/<page>/index.html', () => {
    expect(routeOutputFile({ path: '/web' })).toBe('web/index.html');
    expect(routeOutputFile({ path: '/web/sluzby' })).toBe('web/sluzby/index.html');
  });

  it('is wired in vercel.json: a rewrite for every page before the SPA fallback', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] };
    const sources = config.rewrites.map((rule) => rule.source);
    for (const route of WEB_ROUTES) {
      const rule = config.rewrites.find((r) => r.source === route.path);
      expect(rule?.destination, route.path).toBe(`/${routeOutputFile(route)}`);
      expect(sources.indexOf(route.path)).toBeLessThan(sources.length - 1);
    }
    expect(config.rewrites[config.rewrites.length - 1].destination).toBe('/index.html');
  });
});
