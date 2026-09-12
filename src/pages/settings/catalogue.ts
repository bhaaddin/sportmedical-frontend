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
  adminOnly?: boolean;
  /**
   * Shown but not offered, with the reason. A screen that exists and cannot
   * work is worse hidden than labelled: hidden, somebody rebuilds it; labelled,
   * they know when it is coming.
   */
  unavailable?: string;
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
        id: 'kalendare',
        label: 'Kalendáře',
        description: 'Seznam kalendářů, kdo do kterého vidí, období a pracovní doba',
        to: '/calendars',
        adminOnly: true,
      },
      {
        id: 'cinnosti',
        label: 'Činnosti',
        description: 'Co se v ordinaci dělá a jak dlouho to trvá',
        to: '/activities',
        adminOnly: true,
      },
      {
        id: 'pracovni-doba',
        label: 'Pracovní doba',
        description: 'Hodiny podle dnů, obědová pauza, kdo slouží',
        to: '/working-hours',
        adminOnly: true,
      },
      {
        id: 'vyjimky',
        label: 'Výjimky',
        description: 'Svátky, dovolená a dny, kdy se nepracuje',
        to: '/exceptions',
        adminOnly: true,
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
        description: 'Zaměstnanci, role a resetování hesla',
        to: '/staff-management',
        adminOnly: true,
      },
      {
        id: 'muj-rozvrh',
        label: 'Můj rozvrh',
        description: 'Vaše vlastní směny a dny, kdy jste v ordinaci',
        to: '/worker-schedule',
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
        adminOnly: true,
      },
    ],
  },
  {
    id: 'dokumenty',
    label: 'Dokumenty a souhlasy',
    description: 'Co musí pacient doložit a co podepisuje',
    items: [
      {
        id: 'sablony',
        label: 'Šablony dokumentů',
        description: 'Které dokumenty jsou povinné a kdy',
        to: '/documents',
      },
      {
        id: 'emaily',
        label: 'E-mailové šablony',
        description: 'Text a vzhled e-mailů, které chodí pacientům',
        to: '/email-templates',
        adminOnly: true,
        unavailable: 'Chystá se ve fázi 2 — server pro ně zatím nemá rozhraní.',
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
        adminOnly: true,
      },
      {
        id: 'zdravi',
        label: 'Zdraví systému',
        description: 'Chyby, přihlášená zařízení a stav služeb',
        to: '/system-health',
        adminOnly: true,
      },
      {
        id: 'export',
        label: 'Export dat',
        description: 'Stažení dat pacienta pro předání nebo archiv',
        to: '/data-export',
        adminOnly: true,
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
 * screen she opens to change her own font size.
 */
export function visibleSections(isAdmin: boolean): SettingsSection[] {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isAdmin || item.adminOnly !== true),
  })).filter((section) => section.items.length > 0);
}

/** Every destination, for the test that holds them against the router. */
export function allDestinations(): string[] {
  return SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.to));
}
