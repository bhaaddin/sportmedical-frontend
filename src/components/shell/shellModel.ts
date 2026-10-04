import type { MenuEntry, ShellNav } from './shellTypes';
import type { Permission } from '../../auth/usePermission';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { PATIENT_SECTIONS, sectionPath } from '../../pages/patients/sections';

/** Is `pathname` the screen at `path`, or inside it? (`/patients` is not `/patients-x`.) */
export function isActivePath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/*
 * The sidebar is contextual: where you are decides what hangs under the open
 * entry. This is the model of the three entries whose children are the
 * working screens of that area (pure data - the icons are attached in
 * `App.tsx`, which owns the menu the shell reads).
 *
 *  - `shortcut`   a link that starts something on its target screen (it
 *                 carries `state`) and is never drawn as "the screen you are on";
 *  - `requires`   the permission behind the screen, as everywhere in the menu.
 *
 * Nothing here may also be a settings destination: `shellModel.test.ts` holds
 * that line (which is why "Blokovaný čas", a settings screen, is not a child
 * of the calendar).
 */
export interface ChildSpec {
  text: string;
  path: string;
  requires?: Permission;
  state?: unknown;
  shortcut?: boolean;
}

export type ContextualParent = '/planovani' | '/patients' | '/clubs';

export const SECTION_CHILDREN: Record<ContextualParent, ChildSpec[]> = {
  '/planovani': [
    { text: 'Dnešní přehled', path: '/dnes' },
    { text: 'Přehled podle služeb', path: '/prehled-sluzeb' },
    { text: 'Dostupnost', path: '/availability' },
    { text: 'Klubová objednávka', path: '/planovani', state: { openClubOrder: true }, shortcut: true },
  ],
  '/patients': [
    { text: 'Přehled pacientů', path: '/patients' },
    { text: 'Nový pacient', path: '/patients/register', requires: 'patients.register' },
    { text: 'Kontrola registrací', path: '/intake-review', requires: 'patients.register' },
  ],
  '/clubs': [
    { text: 'Přehled klubů', path: '/clubs' },
    { text: 'Objednávky klubů', path: '/clubs/objednavky' },
    { text: 'Rezervace', path: '/clubs/rezervace' },
    { text: 'Hráči', path: '/clubs/hraci' },
    { text: 'Statistiky', path: '/clubs/statistiky' },
    { text: 'Fakturace', path: '/clubs/fakturace' },
  ],
};

/**
 * Which entry's children belong to this address, and which they are - or null
 * when the address is outside the three contextual areas (the other entries
 * keep the children their menu literal gives them).
 */
export function childrenFor(pathname: string): { parent: ContextualParent; items: ChildSpec[] } | null {
  for (const parent of Object.keys(SECTION_CHILDREN) as ContextualParent[]) {
    const items = SECTION_CHILDREN[parent];
    const own =
      isActivePath(pathname, parent) ||
      (parent === '/planovani' && pathname.startsWith('/kalendar/')) ||
      items.some((c) => !c.shortcut && isActivePath(pathname, c.path));
    if (own) return { parent, items };
  }
  return null;
}

/**
 * The one child that is the screen: of those whose path contains the address,
 * the most specific - so "Přehled klubů" (`/clubs`) is lit on a club's page
 * but not on `/clubs/hraci`, which belongs to "Hráči".
 */
export function activeChildPath(pathname: string, items: MenuEntry[], exact: boolean): string | null {
  let best: string | null = null;
  for (const c of items) {
    if (c.shortcut) continue;
    const hit = exact ? pathname === c.path : isActivePath(pathname, c.path);
    if (hit && (best === null || c.path.length > best.length)) best = c.path;
  }
  return best;
}

/**
 * What hangs under an entry when it is the open one: inside a patient's file
 * the file's own sections, otherwise the entry's children.
 */
export function childrenOf(nav: ShellNav, entry: MenuEntry): { items: MenuEntry[]; exact: boolean } {
  if (entry.path === '/patients' && nav.patientId !== null) {
    const id = nav.patientId;
    return {
      exact: true,
      items: PATIENT_SECTIONS
        .filter((section) => section.id !== 'faktury' || nav.canSeeInvoices)
        .map((section) => ({ text: section.label, icon: section.icon, path: sectionPath(id, section) })),
    };
  }
  return { items: entry.children ?? [], exact: false };
}

export interface EntryState {
  /** This entry's own page is the screen (and none of its children is). */
  self: boolean;
  /** One of its children is the screen. */
  childActive: boolean;
  /** The screen belongs to this entry - its children are shown. */
  inSection: boolean;
  items: MenuEntry[];
  exact: boolean;
}

export function entryState(nav: ShellNav, entry: MenuEntry): EntryState {
  const { items, exact } = childrenOf(nav, entry);
  const childActive = activeChildPath(nav.pathname, items, exact) !== null;
  const own = isActivePath(nav.pathname, entry.path) || childrenFor(nav.pathname)?.parent === entry.path;
  const self = own && !childActive;
  return { self, childActive, inSection: self || childActive, items, exact };
}

export function childIsActive(nav: ShellNav, child: MenuEntry, siblings: MenuEntry[], exact: boolean): boolean {
  return !child.shortcut && activeChildPath(nav.pathname, siblings, exact) === child.path;
}

/** The six entries of the working day: the menu without "Přehled" (the brand is its way in). */
export const mainEntries = (menu: MenuEntry[]): MenuEntry[] => menu.filter((e) => e.path !== STAFF_HOME_PATH);

/** A shorter label where a narrow column cannot hold the full one. */
export const shortLabel = (text: string): string => (text === 'Kluby a týmy' ? 'Kluby' : text);
