import type { MenuEntry, ShellNav } from './shellTypes';
import { STAFF_HOME_PATH } from '../../web/sitePaths';
import { PATIENT_SECTIONS, sectionPath } from '../../pages/patients/sections';

/** Is `pathname` the screen at `path`, or inside it? (`/patients` is not `/patients-x`.) */
export function isActivePath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
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
  const childActive = items.some((c) => (exact ? nav.pathname === c.path : isActivePath(nav.pathname, c.path)));
  const own =
    isActivePath(nav.pathname, entry.path) ||
    (entry.path === '/planovani' && nav.pathname.startsWith('/kalendar/'));
  const self = own && !childActive;
  return { self, childActive, inSection: self || childActive, items, exact };
}

export function childIsActive(nav: ShellNav, child: MenuEntry, exact: boolean): boolean {
  return exact ? nav.pathname === child.path : isActivePath(nav.pathname, child.path);
}

/** The six entries of the working day: the menu without "Přehled" (the brand is its way in). */
export const mainEntries = (menu: MenuEntry[]): MenuEntry[] => menu.filter((e) => e.path !== STAFF_HOME_PATH);

/** A shorter label where a narrow column cannot hold the full one. */
export const shortLabel = (text: string): string => (text === 'Kluby a týmy' ? 'Kluby' : text);
