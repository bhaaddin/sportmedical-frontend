/*
 * The public site and the application share one domain, so an address can only belong to one
 * of them. The public pages sit at the root (/sluzby, /cenik, /kluby …); the staff portal and
 * the patient app pages must never claim the same path, or the visitor would get the wrong
 * bundle (a staff screen shadowed by a marketing page, or the other way round).
 *
 * "The application's paths" are read from the places that declare them, not from a list kept
 * here: every <Route path="…"> and menu entry in App.tsx, and every destination of the
 * settings catalogue. A new screen is held to the rule the moment it is declared.
 */
import { describe, expect, it } from 'vitest';
import appRaw from '../App.tsx?raw';
import { allDestinations } from '../pages/settings/catalogue';
import { SITE_PAGES, isPublicSitePath } from './sitePaths';

const appSource = appRaw as string;

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const menuPaths = [...appSource.matchAll(/\{ text: '[^']+', icon: <\w+ \/>, path: '([^']+)'/g)].map((m) => m[1]);
const settingsPaths = allDestinations();
const concrete = (paths: string[]) => paths.filter((p) => p !== '*' && p !== '/*');

const APP_PATHS = [...new Set(concrete([...routePaths, ...menuPaths, ...settingsPaths]))];
const PUBLIC_PATH_LIST: string[] = SITE_PAGES.map((page) => page.path);

const firstSegment = (p: string) => `/${p.split('/')[1] ?? ''}`;

describe('public site vs application: no shared address', () => {
  it("finds the application's routes at all (so the checks below cannot pass on an empty list)", () => {
    expect(APP_PATHS.length).toBeGreaterThan(60);
    expect(APP_PATHS).toContain('/login');
    expect(APP_PATHS).toContain('/prehled');
    expect(APP_PATHS).toContain('/objednat');
    expect(APP_PATHS).toContain('/nastaveni/cenik');
    expect(APP_PATHS).toContain('/clubs');
  });

  it('shares no path between a staff/app route and a public page', () => {
    const shared = APP_PATHS.filter((p) => PUBLIC_PATH_LIST.includes(p) || isPublicSitePath(p));
    expect(shared).toEqual([]);
  });

  it('shares no first segment either: /sluzby/x must not be a staff screen behind a public /sluzby', () => {
    const publicSegments = new Set(PUBLIC_PATH_LIST.filter((p) => p !== '/').map(firstSegment));
    const clashes = APP_PATHS.filter((p) => p !== '/' && publicSegments.has(firstSegment(p)));
    expect(clashes).toEqual([]);
  });

  it('keeps the moves of this change: the staff overview, price list and services are not at the public addresses', () => {
    expect(APP_PATHS).not.toContain('/');
    expect(APP_PATHS).not.toContain('/cenik');
    expect(APP_PATHS).not.toContain('/sluzby');
    expect(APP_PATHS).toContain('/nastaveni/sluzby');
    expect(APP_PATHS).toContain('/clubs');
    expect(APP_PATHS).not.toContain('/kluby');
  });

  it('keeps the patient-facing app pages where they were', () => {
    for (const path of ['/objednat', '/dotaznik', '/dokonceni/:token', '/klub/:token', '/rezervace/:token', '/hodnoceni/:token', '/portal', '/portal/prihlaseni']) {
      expect(routePaths, path).toContain(path);
    }
  });
});
