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
        adminOnly: true,
      },
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
        description: 'Hodiny podle dnů, obědová pauza, kdo slouží a co se který den dělá',
        to: '/working-hours',
        adminOnly: true,
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
        adminOnly: true,
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
        adminOnly: true,
      },
      {
        /*
         * He was promised these and then nobody built the screen - "bavili
         * sme sa s backendom ze budem moct nastavit i farby alertov ...
         * nevidim to nikde". Once for the whole application: a colour is the
         * word for a state, and the same state must not be green here and
         * amber there. When it lights up is on the rule; what it looks like
         * is here.
         */
        id: 'barvy-upozorneni',
        label: 'Barvy upozornění',
        description: 'Jak se barevně odlišuje, jak na tom doklad pacienta je',
        to: '/barvy-upozorneni',
        adminOnly: true,
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
        adminOnly: true,
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
