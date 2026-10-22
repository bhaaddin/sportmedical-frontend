import { describe, it, expect } from 'vitest';
import { SECTION_CHILDREN, activeChildPath, childrenFor } from './shellModel';
import { SETTINGS_SECTIONS, settingsItemAt } from '../../pages/settings/catalogue';
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
    ['/billing', '/billing'],
    ['/cashier', '/billing'],
    ['/accounting-export', '/billing'],
    ['/diagnostics/new', '/patients'],
  ])('%s belongs to %s', (pathname, parent) => {
    expect(childrenFor(pathname)?.parent).toBe(parent);
  });

  it.each(['/settings', '/prehled', '/clubsx'])('%s is outside the contextual areas', (pathname) => {
    expect(childrenFor(pathname)).toBeNull();
  });

  it('gives Kluby its five screens, in order (R14b: no Rezervace)', () => {
    expect(childrenFor('/clubs')?.items.map((c) => c.text)).toEqual([
      'Přehled klubů', 'Objednávky klubů', 'Hráči', 'Statistiky', 'Fakturace',
    ]);
  });

  it('R19: no entry STARTS something - Nový pacient, Rychlá registrace and Klubová objednávka are not menu children', () => {
    const texts = Object.values(SECTION_CHILDREN).flat().map((c) => c.text);
    for (const action of ['Nový pacient', 'Rychlá registrace', 'Klubová objednávka', 'Nová objednávka']) expect(texts).not.toContain(action);
    expect(Object.values(SECTION_CHILDREN).flat().some((c) => c.shortcut)).toBe(false);
  });

  it('gives Pacienti the overview and the registration check, nothing that starts a registration', () => {
    expect(childrenFor('/patients')?.items.map((c) => c.text)).toEqual(['Přehled pacientů', 'Kontrola registrací']);
  });

  it('gives Fakturace its three screens', () => {
    expect(childrenFor('/billing')?.items.map((c) => c.text)).toEqual(['Faktury', 'Pokladna', 'Účetní export']);
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
    expect(activeChildPath('/planovani', asMenu('/planovani'), false)).toBe('/planovani');
    /* The registration page is inside Pacienti, and the overview is the child that is lit there. */
    expect(activeChildPath('/patients/register', asMenu('/patients'), false)).toBe('/patients');
    expect(activeChildPath('/intake-review', asMenu('/patients'), false)).toBe('/intake-review');
    /* A shortcut (should one return) is never the screen. */
    const withShortcut: MenuEntry[] = [{ text: 'Start', path: '/planovani', icon: null, shortcut: true }, { text: 'Kalendář', path: '/planovani', icon: null }];
    expect(activeChildPath('/planovani', withShortcut, false)).toBe('/planovani');
  });
});

describe('settings: a service detail still lights Služby', () => {
  it('/nastaveni/sluzby/:id belongs to the Služby item', () => {
    expect(settingsItemAt('/nastaveni/sluzby/abc-123')?.item.to).toBe('/nastaveni/sluzby');
  });
});
