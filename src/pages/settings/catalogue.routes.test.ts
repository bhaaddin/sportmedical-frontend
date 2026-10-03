/*
 * Walk every catalogue item the OWNER sees and hold it against the router.
 *
 * "Tým, Zaměstnanci, Zabezpečení look the same and show NOTHING after a
 * click." A click that shows nothing has three causes, and this walk catches
 * each of them without a browser:
 *
 *   1. the item's route is not registered in App.tsx            -> NotFound
 *   2. the route is guarded by a permission the item does not
 *      ask for (or the Owner does not hold)                     -> NotFound
 *   3. the route points at a page module that does not exist    -> blank / crash
 *
 * App.tsx is parsed as text, the same way catalogue.test.ts does.
 */
import { describe, it, expect } from 'vitest';
import appRaw from '../../App.tsx?raw';
import type { Permission } from '../../auth/usePermission';
import { SETTINGS_SECTIONS, visibleSections } from './catalogue';

const appSource = appRaw as string;

/** Every permission the server defines - the Owner holds all of them. */
const OWNER = [
  'patients.view', 'patients.register', 'patients.edit', 'patients.sensitive_identity.view', 'patients.view_all',
  'settings.clinic.manage', 'users.manage', 'roles.manage', 'bookings.create', 'bookings.edit', 'bookings.cancel',
  'questionnaires.manage', 'billing.manage', 'documents.view', 'documents.manage', 'communication.manage',
] as const satisfies readonly Permission[];

/** `const Name = lazy(() => import('./pages/x'))` -> Name => './pages/x' */
const lazyModules = new Map(
  [...appSource.matchAll(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)\)/g)].map((m) => [m[1], m[2]] as const),
);

/** Every file under src/, keyed like `/src/pages/Admin.tsx`. */
const files = new Set(Object.keys(import.meta.glob('/src/**/*.{ts,tsx}')));

/** The Route line for an address: its element text and the guard around it, if any. */
function routeLine(path: string): string | undefined {
  return appSource.split('\n').find((line) => line.includes(`<Route path="${path}"`));
}

const items = visibleSections(OWNER).flatMap((s) => s.items.map((item) => ({ section: s, item })));

describe('the Owner sees every settings item', () => {
  it('and that is all of them', () => {
    expect(items.length).toBe(SETTINGS_SECTIONS.reduce((n, s) => n + s.items.length, 0));
  });

  it('finds the router and the lazy imports at all', () => {
    /* Guards the parsing: matching nothing would pass the walk for the wrong reason. */
    expect(lazyModules.size).toBeGreaterThan(20);
    expect(routeLine('/staff-management')).toBeDefined();
    expect(files.has('/src/pages/StaffManagement.tsx')).toBe(true);
  });

  describe.each(items.map(({ section, item }) => [`${section.label} / ${item.label}`, item] as const))('%s', (_name, item) => {
    it(`has its route ${item.to} registered in App.tsx`, () => {
      expect(routeLine(item.to), `App.tsx has no <Route path="${item.to}">`).toBeDefined();
    });

    it('is guarded by exactly the permission the menu hides it by, and the Owner holds it', () => {
      const line = routeLine(item.to);
      if (line === undefined) return; /* the test above already says so */
      const guard = /<RequirePermission of="([a-z._]+)">/.exec(line)?.[1];
      expect(guard).toBe(item.requires);
      if (guard !== undefined) expect(OWNER).toContain(guard);
    });

    it('opens a page module that exists', () => {
      const line = routeLine(item.to);
      if (line === undefined) return;
      const names = [...line.matchAll(/<([A-Z]\w+)\s*\/?>/g)].map((m) => m[1]).filter((n) => n !== 'RequirePermission' && n !== 'Suspense' && n !== 'Navigate');
      expect(names.length, `no page element on the route line for ${item.to}`).toBeGreaterThan(0);
      const importPath = lazyModules.get(names[0]);
      expect(importPath, `${names[0]} is not lazy-imported in App.tsx`).toBeDefined();
      const base = `/src/${(importPath as string).replace(/^\.\//, '')}`;
      expect(
        files.has(`${base}.tsx`) || files.has(`${base}/index.tsx`) || files.has(`${base}.ts`),
        `${base} does not exist`,
      ).toBe(true);
    });
  });
});

describe('an employee without a permission does not see the item at all', () => {
  it('never lists a guarded item for somebody who lacks its permission', () => {
    const held = new Set<string>(OWNER.filter((p) => p !== 'users.manage'));
    const shown = visibleSections(held).flatMap((s) => s.items);
    expect(shown.find((i) => i.id === 'tym')).toBeUndefined();
    for (const item of shown) {
      if (item.requires !== undefined) expect(held.has(item.requires)).toBe(true);
    }
  });
});
