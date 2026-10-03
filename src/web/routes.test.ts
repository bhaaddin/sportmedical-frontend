import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOT_FOUND_META, WEB_ROUTES, findWebRoute, normalizeWebPath, routeOutputFile } from './routes';
import { SITE_PAGES, isPublicSitePath, legacyWebRedirect } from './sitePaths';
import { SLOTS_BY_PAGE } from '../site/siteSlots';

const PATHS = [
  '/', '/sluzby', '/prohlidky', '/diagnostika', '/inbody',
  '/cenik', '/dokumenty', '/kontakt', '/o-nas', '/kluby',
  '/faq', '/obchodni-podminky', '/ochrana-osobnich-udaju', '/storno-a-reklamace', '/vybaveni', '/partneri',
  '/diagnostika/zakladni', '/diagnostika/komplexni', '/diagnostika/vo2max', '/diagnostika/kompenzacni-plan',
];

interface VercelConfig {
  redirects: { source: string; destination: string; statusCode: number }[];
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
}
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;

describe('the route table of the public site', () => {
  it('lists the pages at the root of the domain, in order — and no /web anywhere', () => {
    expect(WEB_ROUTES.map((route) => route.path)).toEqual(PATHS);
    for (const route of WEB_ROUTES) expect(route.path).not.toMatch(/^\/web(?:\/|$)/);
  });

  it('is built from the one list of addresses (sitePaths.ts), so the two cannot drift', () => {
    expect(WEB_ROUTES.map((r) => [r.id, r.path])).toEqual(SITE_PAGES.map((p) => [p.id, p.path]));
  });

  it('gives every route an id, a label, a title, a description and a component', () => {
    expect(new Set(WEB_ROUTES.map((r) => r.id)).size).toBe(WEB_ROUTES.length);
    for (const route of WEB_ROUTES) {
      expect(route.label).not.toBe('');
      expect(route.title).toContain('SportMedical Diagnostics');
      expect(route.description.length).toBeGreaterThan(30);
      expect(route.description.length).toBeLessThanOrEqual(200);
      expect(typeof route.Component).toBe('function');
      expect(route.path).toMatch(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)?)?$/);
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
    expect(findWebRoute('/')?.id).toBe('landing');
    expect(findWebRoute('')?.id).toBe('landing');
    expect(findWebRoute('/?utm=1#x')?.id).toBe('landing');
    expect(findWebRoute('/cenik/?utm=1#x')?.id).toBe('cenik');
    expect(findWebRoute('/o-nas')?.id).toBe('onas');
    expect(findWebRoute('/neexistuje')).toBeUndefined();
    expect(findWebRoute('/objednat')).toBeUndefined();
    expect(findWebRoute('/web')).toBeUndefined();
    expect(findWebRoute('/web/cenik')).toBeUndefined();
    expect(normalizeWebPath('/kluby///')).toBe('/kluby');
  });

  it('tells the bundle picker which addresses are public — and lets everything else fall through to the app', () => {
    for (const path of PATHS) expect(isPublicSitePath(path), path).toBe(true);
    expect(isPublicSitePath('/cenik/?x=1')).toBe(true);
    for (const path of ['/login', '/prehled', '/objednat', '/portal', '/clubs', '/patients/1', '/web', '/sluzby/x', '/cenik-x']) {
      expect(isPublicSitePath(path), path).toBe(false);
    }
  });

  it('writes the landing page to dist/index.html and every other page to dist/<page>/index.html', () => {
    expect(routeOutputFile({ path: '/' })).toBe('index.html');
    expect(routeOutputFile({ path: '/sluzby' })).toBe('sluzby/index.html');
    expect(routeOutputFile({ path: '/o-nas' })).toBe('o-nas/index.html');
  });
});

describe('vercel.json', () => {
  it('has a rewrite to the prerendered file of every page except the landing page (dist/index.html is served as "/")', () => {
    for (const route of WEB_ROUTES.filter((r) => r.path !== '/')) {
      const rule = vercel.rewrites.find((r) => r.source === route.path);
      expect(rule?.destination, route.path).toBe(`/${routeOutputFile(route)}`);
      expect(vercel.rewrites.indexOf(rule!)).toBeLessThan(vercel.rewrites.length - 1);
    }
    expect(vercel.rewrites.some((r) => r.source === '/')).toBe(false);
  });

  it('sends everything else to the SPA shell dist/app.html — but never an asset and never "/" (the landing page)', () => {
    const last = vercel.rewrites[vercel.rewrites.length - 1];
    expect(last.destination).toBe('/app.html');
    const fallback = new RegExp(`^${last.source}$`);
    expect(fallback.test('/login')).toBe(true);
    expect(fallback.test('/prehled')).toBe(true);
    expect(fallback.test('/objednat')).toBe(true);
    expect(fallback.test('/assets/index-abc.js')).toBe(false);
    expect(fallback.test('/')).toBe(false);
  });

  it('redirects the old /web addresses with a 308, exactly as legacyWebRedirect does', () => {
    const rules = new Map(vercel.redirects.map((r) => [r.source, r]));
    expect(rules.get('/web')).toMatchObject({ destination: '/', statusCode: 308 });
    expect(rules.get('/web/:path*')).toMatchObject({ destination: '/:path*', statusCode: 308 });
    // The rule above, applied to every public page, gives what the pure function (used by vite preview and main.tsx) gives.
    for (const route of WEB_ROUTES) {
      const old = route.path === '/' ? '/web' : `/web${route.path}`;
      expect(legacyWebRedirect(old), old).toBe(route.path);
    }
    expect(vercel.redirects.every((r) => r.statusCode === 308)).toBe(true);
  });

  it('caches every public page at the edge and the assets for good', () => {
    const cacheFor = (path: string) => {
      const rule = vercel.headers.find((h) => new RegExp(`^${h.source}$`).test(path));
      return rule?.headers.find((h) => h.key === 'Cache-Control')?.value ?? '';
    };
    for (const route of WEB_ROUTES) expect(cacheFor(route.path), route.path).toContain('s-maxage');
    expect(cacheFor('/assets/index-abc.js')).toContain('immutable');
    // The application is never cached at the edge.
    for (const path of ['/login', '/prehled', '/objednat']) expect(cacheFor(path), path).toBe('');
  });
});

describe('legacyWebRedirect', () => {
  it.each([
    ['/web', '/'],
    ['/web/', '/'],
    ['/web/sluzby', '/sluzby'],
    ['/web/cenik/', '/cenik'],
    ['/web/kluby#mam-odkaz', '/kluby#mam-odkaz'],
    ['/web/kontakt?x=1#poptavka', '/kontakt?x=1#poptavka'],
    ['/web?x=1', '/?x=1'],
  ])('%s → %s', (from, to) => {
    expect(legacyWebRedirect(from)).toBe(to);
  });

  it.each(['/', '/sluzby', '/webinar', '/websites/x', '/objednat', '/prehled'])('leaves %s alone', (path) => {
    expect(legacyWebRedirect(path)).toBeNull();
  });
});
