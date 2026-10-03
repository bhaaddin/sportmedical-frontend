/*
 * What the three navigations share: the shape of a menu entry and of the
 * model the shell hands to whichever navigation the width calls for.
 *
 * The menu itself (the six entries and what hangs under them) stays in
 * `App.tsx` as literals - `catalogue.test.ts` and `patientRoutes.test.ts`
 * read those lines as text - and is passed in here, so the sidebar, the
 * tablet rail and the phone's bottom bar can never disagree about it.
 */
import type { ReactNode } from 'react';
import type { Permission } from '../../auth/usePermission';

export interface MenuEntry {
  text: string;
  icon: ReactNode;
  path: string;
  /* `requires` is the permission the server checks behind that screen; an
     entry the signed-in employee does not hold is not drawn. */
  requires?: Permission;
  /** The screens that belong under this one; shown under the entry that is open. */
  children?: MenuEntry[];
}

export interface ShellUser {
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface ShellNav {
  pathname: string;
  /** The entries this person may see, "Přehled" included. */
  menu: MenuEntry[];
  /** The patient whose file is open, or null. */
  patientId: string | null;
  /** May this person see the invoices section of a patient's file? */
  canSeeInvoices: boolean;
  /** On a settings route the main navigation is replaced by the settings one. */
  settingsMode: boolean;
  settingsQuery: string;
  onSettingsQueryChange: (query: string) => void;
  /** Where "Zpět do aplikace" goes: the last screen that was not a settings one. */
  backToAppPath: string;
  user: ShellUser;
  /** The big button: lands on the calendar with the booking drawer open. */
  onNewAppointment: () => void;
  /** The account row's button; the menu itself lives in the shell. */
  onOpenAccountMenu: (anchor: HTMLElement) => void;
}
