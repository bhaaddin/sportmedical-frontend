import type { Permission } from '../../auth/usePermission';

/*
 * What sits in Nastavení, as data rather than as markup.
 *
 * Kept apart from the screen so the shape can be checked without a browser:
 * that nothing is listed twice, that every destination is a route that exists,
 * and - the one that matters - that nothing dead is offered.
 *
 * The groups and their order are the design board's (3. 10. 2026, screen 19):
 * PROVOZ · SLUŽBY A CENY · KLUBY · KOMUNIKACE first, because they are what a
 * clinic opens every week, and then the groups the board did not draw but the
 * application has - the clinic's own identity, what is asked of a patient, the
 * team, and the system's own logs. The same list draws the 240px settings nav
 * on every settings screen and the cards on /settings itself.
 */

export interface SettingsItem {
  /** Stable id - used for the open/closed memory and for tests. */
  id: string;
  label: string;
  /** One line saying what is actually inside. Not decoration: it is what saves the click. */
  description: string;
  to: string;
  /**
   * What a receptionist would TYPE when looking for this screen, and will
   * not find in the label: "oběd" for the opening hours, "heslo" for the
   * two-factor screen, "IČO" for the clinic's own details. Matched without
   * regard to case or diacritics, so "obed" and "OBĚD" land the same.
   */
  keywords: string[];
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
     * Running the week, first - it is what the board opens with. The hours, the
     * pauses, the days the clinic is shut, who is away, and how the calendar
     * grid is drawn. What HAPPENS on a calendar and the calendars themselves
     * sit together, so somebody setting a day up finds the whole of it here.
     */
    id: 'provoz',
    label: 'Provoz',
    description: 'Kdy se pracuje, kdy ne, a jak se kreslí kalendář',
    items: [
      {
        id: 'pracovni-doba',
        label: 'Otevírací doba',
        description: 'Hodiny podle dnů v týdnu, obědová pauza, kdo slouží a co se který den dělá',
        to: '/working-hours',
        keywords: ['oběd', 'obědová pauza', 'polední pauza', 'pauza', 'hodiny', 'pracovní doba', 'ordinační hodiny', 'směny', 'kdo slouží', 'otevřeno', 'zavírací doba', 'rozvrh'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * The board's "Pauzy a přestávky". The regular lunch break is a column
         * of the working hours above; the one-off pauses - a serviced device,
         * a meeting, a course - are blocked time, and that is the screen that
         * holds them. Open to everybody signed in, as blocking time is.
         */
        id: 'blokovany-cas',
        label: 'Pauzy a přestávky',
        description: 'Jednorázové pauzy a blokovaný čas — servis přístroje, porada, školení; pravidelný oběd je v otevírací době',
        to: '/blokovany-cas',
        keywords: ['pauza', 'přestávka', 'oběd', 'polední', 'blokovaný čas', 'blokace', 'servis', 'porada', 'školení', 'zablokovat'],
      },
      {
        /*
         * Above the exceptions on purpose. A statutory holiday closes every
         * calendar by itself; an exception is what one calendar does about one
         * day. Somebody looking for "why is that Monday shut" wants this first.
         */
        id: 'svatky',
        label: 'Svátky a dovolené',
        description: 'Státní svátky, dny kdy přesto pracujeme, a vlastní volno ordinace',
        to: '/svatky',
        keywords: ['svátek', 'státní svátek', 'dovolená', 'volno', 'zavřeno', 'prázdniny', 'dny volna'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * Next to the holidays, because the two go together: a holiday shuts
         * the clinic, an absence takes one worker's days away.
         */
        id: 'nepritomnosti',
        label: 'Nepřítomnost zaměstnanců',
        description: 'Dovolená, nemoc, školení — kdy kdo chybí',
        to: '/nepritomnosti',
        keywords: ['dovolená', 'nemoc', 'nemocenská', 'školení', 'volno', 'absence', 'zaměstnanec', 'lékař', 'kdo chybí'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'vyjimky',
        label: 'Výjimky',
        description: 'Jeden den jinak: zavřeno, jiné hodiny nebo zástup',
        to: '/exceptions',
        keywords: ['výjimka', 'jeden den', 'jinak', 'zástup', 'zavřeno', 'jiné hodiny', 'mimořádně'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'vzhled-kalendare',
        label: 'Kalendář a mřížka',
        description: 'Výchozí pohled, krok mřížky, od kdy do kdy se den ukazuje a barvy čar a pauz',
        to: '/nastaveni/vzhled-kalendare',
        keywords: ['barvy', 'barva', 'mřížka', 'krok', 'krok mřížky', 'zobrazení', 'vzhled', 'pohled', 'den týden měsíc', 'rozlišení', 'od kdy do kdy'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'kalendare',
        label: 'Kalendáře',
        description: 'Seznam kalendářů, kdo do kterého vidí, období a pracovní doba',
        to: '/calendars',
        keywords: ['kalendář', 'kalendáře', 'viditelnost', 'kdo vidí', 'období', 'cyklus'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * What the clinic does and what it costs - the board's SLUŽBY A CENY.
     *
     * The id stays `platby`: the price list moved twice before landing under
     * one heading with the money, and the owner said it plainly - what it
     * costs and what is sold sit together. The board's "Délky a kapacity" is
     * the činnosti screen itself (a činnost is its length), so it is one row,
     * not two rows to one screen.
     */
    id: 'platby',
    label: 'Služby a ceny',
    description: 'Co ordinace nabízí, jak dlouho to trvá a co to stojí',
    items: [
      {
        id: 'sluzby',
        label: 'Služby',
        description: 'Co ordinace dělá — činnosti patří pod službu a kalendář službu provozuje',
        to: '/sluzby',
        keywords: ['služba', 'služby', 'nabídka', 'co děláme', 'prohlídka'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'cinnosti',
        label: 'Činnosti',
        description: 'Co se v ordinaci dělá, délky a kapacity, dotazník a souhlasy k činnosti',
        to: '/activities',
        keywords: ['činnost', 'činnosti', 'délka', 'délky', 'kapacita', 'kapacity', 'trvání', 'minuty', 'prohlídka', 'výkon'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'cenik',
        label: 'Ceník',
        description: 'Co ordinace účtuje — odsud si činnost bere svou cenu',
        to: '/cenik',
        keywords: ['ceny', 'cena', 'kč', 'ceník', 'položka', 'položky', 'kolik stojí', 'sazba', 'účtování'],
      },
      {
        id: 'skupinove-slevy',
        label: 'Slevy a cenové hladiny',
        description: 'Čím víc lidí přijde společně, tím větší sleva — hladiny podle počtu osob',
        to: '/nastaveni/skupinove-slevy',
        keywords: ['sleva', 'slevy', 'procenta', '%', 'hladina', 'cenové hladiny', 'skupina', 'klub', 'množstevní'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * The clubs' side of the configuration. The clubs themselves - who they
     * are, their bookings - are a screen of the working day and sit in the
     * sidebar; what belongs here is the time held for them and the links
     * their athletes register through, which the same screen holds.
     */
    id: 'kluby',
    label: 'Kluby',
    description: 'Hromadné objednávky pro kluby a odkazy pro jejich sportovce',
    items: [
      {
        id: 'vyhrazeni',
        label: 'Hromadné objednávky',
        description: 'Časy držené pro klub, registrační odkazy pro sportovce a lhůty, kdy se místa uvolní',
        to: '/vyhrazeni',
        keywords: ['klub', 'kluby', 'hromadná objednávka', 'hromadné', 'registrační odkaz', 'odkaz pro sportovce', 'vyhrazení', 'držená místa', 'lhůta', 'faktura klubu', 'plátce'],
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
        label: 'SMS a e-maily',
        description: 'Předmět a text zpráv — úprava, náhled se vzorovými hodnotami a testovací odeslání',
        to: '/nastaveni/sablony-emailu',
        keywords: ['email', 'e-mail', 'sms', 'šablona', 'šablony', 'text zprávy', 'zpráva', 'potvrzení', 'předmět', 'testovací odeslání', 'notifikace'],
        requires: 'communication.manage',
      },
      {
        id: 'pripominky',
        label: 'Připomínky',
        description: 'Kolik hodin před termínem odejde pacientovi připomínka',
        to: '/nastaveni/pripominky',
        keywords: ['připomínka', 'připomenutí', 'upomínka', 'sms', 'email', 'hodin před termínem', 'notifikace'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'hodnoceni-pacientu',
        label: 'Hodnocení pacientů',
        description: 'Co pacienti napsali po dokončené návštěvě — soukromé, nic se nezveřejňuje',
        to: '/hodnoceni-pacientu',
        keywords: ['hodnocení', 'recenze', 'zpětná vazba', 'feedback', 'spokojenost', 'hvězdičky'],
      },
    ],
  },
  {
    /*
     * Who the clinic is: its name, contacts and what the public sees. Not
     * "Ordinace" alone - a calendar is often called that, and a word that
     * names two things is a word that finds the wrong one.
     */
    id: 'ordinace',
    label: 'Ordinace a web',
    description: 'Kdo jste — veřejná identita, kontakty a firemní údaje vaší ordinace',
    items: [
      {
        id: 'verejny-web',
        label: 'Údaje ordinace a veřejný web',
        description: 'Název, adresa, telefon, firemní údaje a co se ukazuje pacientům',
        to: '/admin',
        keywords: ['ordinace', 'název', 'adresa', 'telefon', 'faktura', 'ičo', 'dič', 'plátce dph', 'firemní údaje', 'fakturační údaje', 'web', 'veřejný web', 'logo', 'kontakt'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    id: 'pacienti',
    label: 'Pacienti',
    description: 'Co se o pacientovi ukazuje a co pacient vyplňuje, podepisuje a dokládá',
    items: [
      {
        id: 'udaje-pacienta',
        label: 'Údaje pacienta',
        description: 'Které údaje karta a seznam pacientů ukazují a v jakém pořadí',
        to: '/nastaveni/udaje-pacienta',
        keywords: ['pacient', 'karta', 'pole', 'sloupce', 'údaje', 'pořadí', 'rodné číslo', 'pojišťovna', 'seznam pacientů'],
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
        keywords: ['dotazník', 'anamnéza', 'otázky', 'otázka', 'zdravotní dotazník', 'vstupní dotazník', 'formulář'],
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
        keywords: ['souhlas', 'gdpr', 'marketing', 'marketingový souhlas', 'podpis', 'objednávkový formulář', 'newsletter'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * Above the rules, because a rule points at one of these and the
         * owner met them in the wrong order: he opened the rule screen, saw
         * four documents he thought he had deleted, and had nowhere to go.
         */
        id: 'dokumenty-sablony',
        label: 'Dokumenty',
        description: 'Druhy dokumentů, které ordinace vede — název, popis a co se používá',
        to: '/dokumenty-sablony',
        keywords: ['dokument', 'dokumenty', 'druh dokumentu', 'výpis', 'potvrzení', 'lékařská zpráva', 'gdpr', 'souhlas', 'šablona dokumentu'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'pravidla-dokumentu',
        label: 'Pravidla dokumentů',
        description: 'Co musí pacient doložit a ke které službě — činnosti pod ní to dědí',
        to: '/pravidla-dokumentu',
        keywords: ['dokument', 'pravidlo', 'doložit', 'povinné dokumenty', 'výpis', 'ke které službě', 'co pacient přinese'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    id: 'tym',
    label: 'Tým',
    description: 'Kdo u vás pracuje a co smí, a jak je chráněn váš vlastní účet',
    items: [
      {
        id: 'tym',
        label: 'Zaměstnanci',
        description: 'Zaměstnanci, jejich role a oprávnění, reset hesla a vypnutí přístupu',
        to: '/staff-management',
        keywords: ['zaměstnanec', 'zaměstnanci', 'lékař', 'lékaři', 'sestra', 'recepce', 'uživatel', 'uživatelé', 'práva', 'oprávnění', 'role', 'reset hesla', 'přístup', 'nový účet'],
        requires: 'users.manage',
      },
      {
        /*
         * Personal, not administrative: every signed-in user secures their
         * own account here, so no `requires` — unlike the admin screens.
         */
        id: 'dvoufazove',
        label: 'Zabezpečení',
        description: 'Dvoufázové ověření — chraňte svůj účet jednorázovým kódem z ověřovací aplikace',
        to: '/nastaveni/zabezpeceni',
        keywords: ['heslo', '2fa', 'dvoufázové', 'dvoufaktorové', 'přihlášení', 'ověření', 'kód', 'authenticator', 'bezpečnost', 'účet'],
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
        keywords: ['audit', 'log', 'historie změn', 'kdo co změnil', 'protokol', 'záznam', 'přístupy'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'zdravi',
        label: 'Zdraví systému',
        description: 'Chyby, přihlášená zařízení a stav služeb',
        to: '/system-health',
        keywords: ['chyby', 'stav systému', 'zařízení', 'přihlášená zařízení', 'server', 'health', 'diagnostika systému'],
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

/**
 * Lower-case, no diacritics, one space between words. "Otevírací DOBA" and
 * "oteviraci doba" are the same thing to a search box.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A settings row with the group it sits in, and how well it answered a search. */
export interface SettingsHit {
  item: SettingsItem;
  section: SettingsSection;
  /** 0 = the label says it, 1 = a keyword says it, 2 = only the description or the group does. */
  rank: 0 | 1 | 2;
}

/**
 * How well one row answers a query, or null if it does not.
 *
 * Every word of the query has to be found somewhere in the row - its label,
 * its keywords, its description or its group - so "oběd pauza" narrows rather
 * than widens. The rank says WHERE the best word was found: a row whose label
 * holds every word ranks above one that only a keyword matched, which ranks
 * above one that only the description matched.
 */
function rankItem(item: SettingsItem, section: SettingsSection, words: string[]): SettingsHit['rank'] | null {
  const label = normalizeText(item.label);
  const keywords = normalizeText(item.keywords.join(' '));
  const rest = normalizeText(`${item.description} ${section.label} ${section.description}`);
  if (words.every((w) => label.includes(w))) return 0;
  if (words.every((w) => label.includes(w) || keywords.includes(w))) return 1;
  if (words.every((w) => label.includes(w) || keywords.includes(w) || rest.includes(w))) return 2;
  return null;
}

/**
 * Every row that answers a query, best first - what the Ctrl+K palette lists.
 * Within one rank the catalogue's own order holds, so the board's groups stay
 * in the order they are drawn.
 */
export function searchSettingsItems(sections: SettingsSection[], query: string): SettingsHit[] {
  const words = normalizeText(query).split(' ').filter((w) => w !== '');
  if (words.length === 0) {
    return sections.flatMap((section) => section.items.map((item) => ({ item, section, rank: 2 as const })));
  }
  const hits: SettingsHit[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const rank = rankItem(item, section, words);
      if (rank !== null) hits.push({ item, section, rank });
    }
  }
  return hits.sort((a, b) => a.rank - b.rank);
}

/**
 * The sections narrowed to a search - the box at the top of the settings nav.
 * It matches an item's label, its keywords, its description and its section's
 * name, without regard to case or diacritics, so "obed" finds the opening
 * hours and "sleva" the price tiers. Rows whose label matches come first in
 * their group, and groups with a label hit come before groups without one.
 * An empty query gives the sections back untouched.
 */
export function searchSections(sections: SettingsSection[], query: string): SettingsSection[] {
  const words = normalizeText(query).split(' ').filter((w) => w !== '');
  if (words.length === 0) return sections;
  return sections
    .map((section) => {
      const ranked = section.items
        .map((item) => ({ item, rank: rankItem(item, section, words) }))
        .filter((r): r is { item: SettingsItem; rank: SettingsHit['rank'] } => r.rank !== null)
        .sort((a, b) => a.rank - b.rank);
      return { section: { ...section, items: ranked.map((r) => r.item) }, best: ranked[0]?.rank ?? 3 };
    })
    .filter((s) => s.section.items.length > 0)
    .sort((a, b) => a.best - b.best)
    .map((s) => s.section);
}

/** Every destination, for the test that holds them against the router. */
export function allDestinations(): string[] {
  return SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.to));
}

/**
 * Which settings screen an address is, if it is one.
 *
 * Exists so the way back can be drawn once - the breadcrumb "Nastavení /
 * Skupina / Stránka" at the top of every settings screen and the active row
 * of the settings nav - instead of pasted into twenty pages.
 *
 * Sub-paths count as the same screen - `/working-hours/anything` is still
 * Otevírací doba - so a screen that grows a detail view does not silently lose
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
