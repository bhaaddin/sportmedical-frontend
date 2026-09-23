import type { Permission } from '../../auth/usePermission';

/*
 * What sits in Nastavení, as data rather than as markup.
 *
 * Kept apart from the screen so the shape can be checked without a browser:
 * that nothing is listed twice, that every destination is a route that exists,
 * and - the one that matters - that nothing dead is offered. Twenty items in a
 * sidebar was the complaint; a tidy menu full of screens that do nothing would
 * be the same complaint with better spacing.
 *
 * The grouping follows the API rather than the file tree, because the API is
 * where the real shape already is:
 *
 *     /api/calendars/{id}/access
 *     /api/calendars/{id}/periods/{p}/working-hours
 *     /api/calendars/{id}/exceptions
 *     /api/calendars/{id}/blocks
 *     /api/calendars/{id}/partner-orders
 *
 * Working hours, exceptions, blocked time and club reservations all hang off a
 * calendar. So they are shown hanging off a calendar, and somebody setting one
 * up finds the whole of it in one place instead of in six sidebar entries.
 */

export interface SettingsItem {
  /** Stable id - used for the open/closed memory and for tests. */
  id: string;
  label: string;
  /** One line saying what is actually inside. Not decoration: it is what saves the click. */
  description: string;
  to: string;
  /**
   * What the server asks for before it will serve this screen.
   *
   * ── Why a permission and not a role ──
   *
   * Access is decided per EMPLOYEE, not per role. The owner's rule:
   * "Administrátor musí mít možnost pro každého zaměstnance nastavit, co může
   * vidět." The administration offers every permission in three states —
   * granted, by role, revoked — so an administrator who had
   * `settings.clinic.manage` taken away sees none of these screens, and a
   * member of staff who was GRANTED `questionnaires.manage` sees that one.
   *
   * The name is the one the controller behind the screen checks, so the menu
   * and the API agree about one list rather than disagreeing about two.
   *
   * Undefined means everybody signed in — the price list the desk quotes
   * from, blocked time.
   */
  requires?: Permission;
}

export interface SettingsSection {
  id: string;
  label: string;
  /** What this whole group is for, in the words somebody would use. */
  description: string;
  items: SettingsItem[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'provoz',
    label: 'Kalendáře a provoz',
    description: 'Kdy se pracuje, co se dělá a kdo co vidí',
    items: [
      {
        /*
         * First, because nothing works without it. A činnost must belong to a
         * service and a calendar that runs none offers nothing on any day - so
         * this is where a new clinic starts, not an afterthought below the
         * things that depend on it.
         */
        id: 'sluzby',
        label: 'Služby',
        description: 'Co ordinace dělá — činnosti patří pod službu',
        to: '/sluzby',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'kalendare',
        label: 'Kalendáře',
        description: 'Seznam kalendářů, kdo do kterého vidí, období a pracovní doba',
        to: '/calendars',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'cinnosti',
        label: 'Činnosti',
        description: 'Co se v ordinaci dělá a jak dlouho to trvá',
        to: '/activities',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'pracovni-doba',
        label: 'Pracovní doba',
        description: 'Hodiny podle dnů, obědová pauza, kdo slouží a co se který den dělá',
        to: '/working-hours',
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * Above the exceptions on purpose. A statutory holiday closes every
         * calendar by itself; an exception is what one calendar does about one
         * day. Somebody looking for "why is that Monday shut" wants this first.
         */
        id: 'svatky',
        label: 'Svátky a volno',
        description: 'Státní svátky, dny kdy pracujeme, a vlastní volno',
        to: '/svatky',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'vyjimky',
        label: 'Výjimky',
        description: 'Jeden den jinak: zavřeno, jiné hodiny nebo zástup',
        to: '/exceptions',
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * Next to Výjimky, because the two go together: an absence takes a
         * worker's days away, and a stand-in in Výjimky is how one of those
         * days is still worked.
         */
        id: 'nepritomnosti',
        label: 'Nepřítomnost zaměstnanců',
        description: 'Dovolená, nemoc, školení — kdy kdo chybí',
        to: '/nepritomnosti',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'vyhrazeni',
        label: 'Vyhrazení pro kluby',
        description: 'Časy držené pro klub a lhůty, kdy se uvolní',
        to: '/vyhrazeni',
      },
      {
        id: 'blokovany-cas',
        label: 'Blokovaný čas',
        description: 'Servis přístroje, porada, školení — čas bez pacienta',
        to: '/blokovany-cas',
      },
    ],
  },
  {
    id: 'lide',
    label: 'Lidé a přístupy',
    description: 'Kdo u vás pracuje a co smí',
    items: [
      {
        id: 'tym',
        label: 'Tým a účty',
        description: 'Zaměstnanci, jejich role, reset hesla a vypnutí přístupu',
        to: '/staff-management',
        requires: 'users.manage',
      },
    ],
  },
  {
    /*
     * Money in one place. The price list moved twice before landing here -
     * first into Ordinace on the reasoning that what a practice charges is a
     * fact about the practice, then beside Činnosti because an činnost takes
     * its price from it. Both were guesses at the owner's model. His is
     * simpler and he said it plainly: payments are their own heading, and the
     * price list and the payers both live under it.
     */
    id: 'platby',
    label: 'Platby',
    description: 'Co co stojí a kdo to platí',
    items: [
      {
        id: 'cenik',
        label: 'Ceník',
        description: 'Co ordinace účtuje — odsud si činnost bere svou cenu',
        to: '/cenik',
      },
      {
        /*
         * "Definice plátců" in the owner's words: who gets the invoice and
         * where it goes. The server has carried all of it from the start -
         * IČO, DIČ, fakturační adresa, bankovní účet, IBAN and splatnost - and
         * the screen collected five of the thirteen fields, none of them the
         * ones you need to send an invoice.
         */
        id: 'platci',
        label: 'Plátci',
        description: 'Kluby a organizace, které platí za členy — fakturační údaje a splatnost',
        to: '/clubs',
      },
    ],
  },
  {
    id: 'ordinace',
    label: 'Ordinace',
    description: 'Údaje o ordinaci a co z nich vidí veřejnost',
    items: [
      {
        id: 'verejny-web',
        label: 'Veřejný web a kontakty',
        description: 'Název, adresa, telefon a co se ukazuje pacientům',
        to: '/admin',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    id: 'dokumenty',
    label: 'Dokumenty a souhlasy',
    description: 'Co musí pacient doložit a co podepisuje',
    items: [
      {
        /*
         * Above the rules, because a rule points at one of these and the
         * owner met them in the wrong order: he opened the rule screen, saw
         * four documents he thought he had deleted, and had nowhere to go.
         * Nothing had deleted them - the API has no DELETE for a template at
         * all - and until 14. 9. 2026 nothing could even switch one off.
         */
        id: 'dokumenty-sablony',
        label: 'Dokumenty',
        description: 'Druhy dokumentů, které ordinace vede — název, popis a co se používá',
        to: '/dokumenty-sablony',
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * The rules it edits decided whether a patient was told to
         * bring a medical record, and until this screen existed they lived
         * only in the database - seeded, never written by anybody here, and
         * hanging off a price-list category nobody had chosen.
         */
        id: 'pravidla-dokumentu',
        label: 'Pravidla dokumentů',
        description: 'Co musí pacient doložit a ke které službě — činnosti pod ní to dědí',
        to: '/pravidla-dokumentu',
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * The questions a patient actually answers. They lived in the browser
         * bundle until 21. 9. 2026 -- seventy-seven of them, with fifty-two
         * more unused in the domain -- so adding one meant a developer and a
         * deploy. This is the screen that ended that.
         */
        id: 'zdravotni-dotaznik',
        label: 'Zdravotní dotazník',
        description: 'Otázky, na které pacient odpovídá — znění, sekce, pořadí a nasazení verze',
        to: '/dotaznik-nastaveni',
        requires: 'questionnaires.manage',
      },
    ],
  },
  {
    id: 'system',
    label: 'Systém',
    description: 'Co se kdy stalo a jak na tom systém je',
    items: [
      {
        id: 'audit',
        label: 'Auditní log',
        description: 'Kdo co změnil a kdy — včetně přístupů k citlivým údajům',
        to: '/audit-log',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'zdravi',
        label: 'Zdraví systému',
        description: 'Chyby, přihlášená zařízení a stav služeb',
        to: '/system-health',
        requires: 'settings.clinic.manage',
      },
    ],
  },
];

/**
 * What this person may open.
 *
 * Items they cannot open are removed rather than greyed out. A locked row
 * invites somebody to ask why, and the answer - "you are not an administrator"
 * - is not something a receptionist can act on, so it is only noise on a
 * screen she opens to see her own account.
 */
/**
 * The settings this person may actually open.
 *
 * Takes the effective permissions the SERVER sent at sign-in: the role's
 * defaults with that person's own grants and revocations already applied.
 *
 * A section left with nothing in it disappears rather than standing empty — a
 * heading over no rows reads like a screen that failed to load.
 *
 * It hides; it does not protect. `localStorage` is the viewer's to edit, and
 * the server refuses these screens on its own account.
 */
export function visibleSections(
  held: ReadonlySet<string> | readonly string[],
): SettingsSection[] {
  const permissions = held instanceof Set ? held : new Set(held);

  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => item.requires === undefined || permissions.has(item.requires),
    ),
  })).filter((section) => section.items.length > 0);
}

/** Every destination, for the test that holds them against the router. */
export function allDestinations(): string[] {
  return SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.to));
}

/**
 * Which settings screen an address is, if it is one.
 *
 * Exists so the way back can be drawn once, by the layout, instead of pasted
 * into fourteen pages. All fourteen destinations in this file were checked on
 * 13. 9. 2026 and not one of them had a back control, a breadcrumb or anything
 * else: clicking into any settings screen left the reader with the sidebar's
 * gear as the only route out, and the sidebar is collapsed to icons.
 *
 * Sub-paths count as the same screen - `/working-hours/anything` is still
 * Pracovní doba - so a screen that grows a detail view does not silently lose
 * its way back.
 */
export function settingsItemAt(
  pathname: string,
): { item: SettingsItem; section: SettingsSection } | null {
  for (const section of SETTINGS_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return { item, section };
      }
    }
  }
  return null;
}
