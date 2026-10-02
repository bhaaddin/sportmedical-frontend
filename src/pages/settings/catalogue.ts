import type { Permission } from '../../auth/usePermission';

/*
 * What sits in Nastavení, as data rather than as markup.
 *
 * Kept apart from the screen so the shape can be checked without a browser:
 * that nothing is listed twice, that every destination is a route that exists,
 * and - the one that matters - that nothing dead is offered.
 *
 * The order is the order a clinic is set up in, not the order the API grew in:
 * who you are, what you offer, what it costs, the calendars, when you work,
 * who works here, what the patient signs, and last the system's own logs. Each
 * heading holds one kind of thing, so nobody hunts for "working hours" inside a
 * ten-item "calendar and operations" drawer again.
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
    /*
     * Who the clinic is, first: a new practice starts by saying its name and
     * what the public sees, before it has a single service or calendar.
     */
    id: 'ordinace',
    label: 'Ordinace',
    /* (Kluby a týmy left this catalogue on 3. 10. 2026: on the design board it
       is a screen of the working day - hromadné objednávky and the athletes'
       registration links - and so it sits in the sidebar, not in Nastavení.) */
    description: 'Kdo jste — veřejná identita a kontakty vaší ordinace',
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
    /*
     * What the clinic does. A činnost belongs to a service, so the two live
     * together and a new clinic builds its offer here before hanging calendars
     * off it.
     */
    id: 'nabidka',
    label: 'Nabídka',
    description: 'Co ordinace nabízí — služby a činnosti pod nimi',
    items: [
      {
        id: 'sluzby',
        label: 'Služby',
        description: 'Co ordinace dělá — činnosti patří pod službu',
        to: '/sluzby',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'cinnosti',
        label: 'Činnosti',
        description: 'Co se v ordinaci dělá a jak dlouho to trvá',
        to: '/activities',
        requires: 'settings.clinic.manage',
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
        id: 'skupinove-slevy',
        label: 'Skupinové slevy',
        description: 'Čím víc lidí přijde společně, tím větší sleva — pásma podle počtu osob',
        to: '/nastaveni/skupinove-slevy',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * The calendars and how they are drawn. What HAPPENS on a calendar - hours,
     * days off, blocks - is the next heading; this one is the calendars
     * themselves and their look, set once and rarely touched again.
     */
    id: 'kalendar',
    label: 'Kalendáře',
    description: 'Kalendáře ordinace a jak se kreslí',
    items: [
      {
        id: 'kalendare',
        label: 'Kalendáře',
        description: 'Seznam kalendářů, kdo do kterého vidí, období a pracovní doba',
        to: '/calendars',
        requires: 'settings.clinic.manage',
      },
      {
        id: 'vzhled-kalendare',
        label: 'Vzhled kalendáře',
        description: 'Výchozí pohled, délka řádku, od kdy do kdy se den ukazuje a barva čáry „teď“',
        to: '/nastaveni/vzhled-kalendare',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * Running the week: the working hours, the days off that close it, the
     * one-off exceptions, who is away, and the time held or blocked for
     * something other than a patient. These used to be scattered through a
     * ten-item drawer with the services and the calendar look; they are the
     * day-to-day of operating, and they belong together.
     */
    id: 'provoz',
    label: 'Provoz a čas',
    description: 'Kdy se pracuje, kdy ne, a jaký čas je držený nebo blokovaný',
    items: [
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
    description: 'Kdo u vás pracuje a co smí, a co se ukazuje o pacientovi',
    items: [
      {
        id: 'tym',
        label: 'Tým a účty',
        description: 'Zaměstnanci, jejich role, reset hesla a vypnutí přístupu',
        to: '/staff-management',
        requires: 'users.manage',
      },
      {
        id: 'udaje-pacienta',
        label: 'Údaje o pacientovi',
        description: 'Které údaje karta a seznam pacientů ukazují a v jakém pořadí',
        to: '/nastaveni/udaje-pacienta',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    id: 'dokumenty',
    label: 'Dokumenty a souhlasy',
    description: 'Co pacient dokládá, podepisuje a vyplňuje',
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
        label: 'Dotazníky',
        description: 'Dotazníky pro pacienty — nový dotazník, otázky, zapnutí a vypnutí a který je výchozí',
        to: '/dotaznik-nastaveni',
        requires: 'questionnaires.manage',
      },
      {
        /*
         * Only the marketing consent: it is the clinic's own to show or hide
         * and to word. The treatment consent (zákon) and the per-činnost
         * report/club consents are not a screen's to switch off.
         */
        id: 'souhlasy',
        label: 'Souhlasy',
        description: 'Marketingový souhlas na objednávkovém formuláři — zda se ukáže a jak zní',
        to: '/nastaveni/souhlasy',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * What the clinic says, not what the patient signs. The e-mail templates —
     * confirmation, reschedule, cancellation and the rest — were editable only
     * through the API until now; the backend has carried save, preview and
     * test-send from the start. Its own heading, under its own permission
     * (communication.manage), because wording the clinic sends is a different
     * job from the documents a patient brings.
     */
    id: 'komunikace',
    label: 'Komunikace',
    description: 'Zprávy, které ordinace posílá pacientům a personálu',
    items: [
      {
        id: 'sablony-emailu',
        label: 'Šablony e-mailů',
        description: 'Předmět a text e-mailů — úprava, náhled se vzorovými hodnotami a test',
        to: '/nastaveni/sablony-emailu',
        requires: 'communication.manage',
      },
      {
        id: 'hodnoceni-pacientu',
        label: 'Hodnocení pacientů',
        description: 'Co pacienti napsali po dokončené návštěvě — soukromé, nic se nezveřejňuje',
        to: '/hodnoceni-pacientu',
      },
      {
        id: 'pripominky',
        label: 'Připomínky termínů',
        description: 'Kolik hodin před termínem odejde pacientovi připomínka e-mailem',
        to: '/nastaveni/pripominky',
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * Personal, not administrative: every signed-in user secures their own
     * account here, so no `requires` — unlike the admin screens above. The
     * backend TOTP flow was complete and had no screen; this is it.
     */
    id: 'zabezpeceni',
    label: 'Zabezpečení',
    description: 'Dvoufázové ověření vašeho účtu',
    items: [
      {
        id: 'dvoufazove',
        label: 'Dvoufázové ověření',
        description: 'Chraňte svůj účet jednorázovým kódem z ověřovací aplikace',
        to: '/nastaveni/zabezpeceni',
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
