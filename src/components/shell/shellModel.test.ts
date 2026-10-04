import { describe, it, expect } from 'vitest';
import { SECTION_CHILDREN, activeChildPath, childrenFor } from './shellModel';
import { SETTINGS_SECTIONS } from '../../pages/settings/catalogue';
import type { MenuEntry } from './shellTypes';

const asMenu = (parent: keyof typeof SECTION_CHILDREN): MenuEntry[] =>
  SECTION_CHILDREN[parent].map((c) => ({ ...c, icon: null }));

describe('childrenFor', () => {
  it.each([
    ['/planovani', '/planovani'],
    ['/kalendar/2026-10-04', '/planovani'],
    ['/dnes', '/planovani'],
    ['/prehled-sluzeb', '/planovani'],
    ['/availability', '/planovani'],
    ['/patients', '/patients'],
    ['/patients/register', '/patients'],
    ['/patients/p-1/terminy', '/patients'],
    ['/intake-review', '/patients'],
    ['/clubs', '/clubs'],
    ['/clubs/objednavky', '/clubs'],
    ['/clubs/abc-123', '/clubs'],
  ])('%s belongs to %s', (pathname, parent) => {
    expect(childrenFor(pathname)?.parent).toBe(parent);
  });

  it.each(['/billing', '/diagnostics/new', '/settings', '/prehled', '/clubsx'])('%s is outside the contextual areas', (pathname) => {
    expect(childrenFor(pathname)).toBeNull();
  });

  it('gives Kluby its six screens, in order', () => {
    expect(childrenFor('/clubs')?.items.map((c) => c.text)).toEqual([
      'Přehled klubů', 'Objednávky klubů', 'Rezervace', 'Hráči', 'Statistiky', 'Fakturace',
    ]);
  });

  it('keeps the club-order shortcut on the calendar, with its marker', () => {
    const shortcut = SECTION_CHILDREN['/planovani'].find((c) => c.shortcut);
    expect(shortcut).toMatchObject({ path: '/planovani', state: { openClubOrder: true } });
  });

  it('shares no screen with the settings catalogue', () => {
    const settings = new Set(SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.to)));
    for (const items of Object.values(SECTION_CHILDREN)) {
      for (const c of items) expect(settings.has(c.path), c.path).toBe(false);
    }
  });
});

describe('activeChildPath', () => {
  it('prefers the most specific child and ignores shortcuts', () => {
    const clubs = asMenu('/clubs');
    expect(activeChildPath('/clubs', clubs, false)).toBe('/clubs');
    expect(activeChildPath('/clubs/abc', clubs, false)).toBe('/clubs');
    expect(activeChildPath('/clubs/hraci', clubs, false)).toBe('/clubs/hraci');
    expect(activeChildPath('/planovani', asMenu('/planovani'), false)).toBeNull();
    expect(activeChildPath('/patients/register', asMenu('/patients'), false)).toBe('/patients/register');
  });
});
