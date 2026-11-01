import type { Permission } from '../../auth/usePermission';

/*
 * What sits in Nastavení and Administrace, as data rather than as markup.
 *
 * Kept apart from the screen so the shape can be checked without a browser:
 * that nothing is listed twice, that every destination is a route that exists,
 * and - the one that matters - that nothing dead is offered.
 *
 * Two areas (Matko, 1. 11. 2026: "Nastavení je moc složité"):
 *  - daily   Nastavení (/nastaveni): one plain page. The `common` screens are listed directly under four headings
 *            (Provoz, Služby a ceny, Komunikace a dokumenty, Kluby); the rest of the daily screens sit in one
 *            collapsed list; "Můj účet a zabezpečení" is the row on top and is for everybody.
 *  - admin   Administrace (/administrace): users and rights, security, the clinic's own data, the public site,
 *            the connections and the records of what changed. Seen ONLY by somebody who may manage users or the
 *            clinic (`canSeeAdmin`): no menu entry, no search hit, and a direct address is the normal "no access".
 *
 * ONE list: the area and the `common` flag are fields of the item, not a second list. Every older address keeps
 * working (`to` and `aliases`; /settings and /settings/:group redirect to the right area - `areaPath`).
 *
 * Where the brief named two items for one screen (Hromadné objednávky + Blokace
 * pro kluby, SMS a e-maily + Šablony zpráv, Uživatelé a práva + Tým +
 * Zaměstnanci) they are ONE honest item here - a second row to the same screen
 * is the "looks the same and shows nothing new" complaint again.
 */

/** Which of the two pages an item lives on. */
export type SettingsArea = 'daily' | 'admin';

/** Seeing the Administrace at all needs ANY of these (the server asks for the same on its screens). */
export const ADMIN_PERMISSIONS: readonly Permission[] = ['users.manage', 'settings.clinic.manage'];

/** The id of the row on top of Nastavení. */
export const ACCOUNT_ITEM_ID = 'dvoufazove';

/** The icon a group tile wears - a name, resolved to a component by the hub. */
export type SettingsGroupIcon =
  | 'provoz'
  | 'sluzby'
  | 'kluby'
  | 'komunikace'
  | 'dokumenty'
  | 'web'
  | 'system';

export interface SettingsItem {
  /** Nastavení (daily) or Administrace (admin). Set from the section. */
  area: SettingsArea;
  /** Shown directly on the Nastavení page (the rest of the daily screens sit in "Další nastavení"). */
  common?: boolean;
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
   * Access is decided per EMPLOYEE, not per role. The name is the one the
   * controller behind the screen checks, so the menu and the API agree about
   * one list rather than disagreeing about two. The Owner holds every one.
   *
   * Undefined means everybody signed in - the price list the desk quotes
   * from, blocked time.
   */
  requires?: Permission;
  /** Shown when the person holds ANY of these; for a screen that combines areas with different owners. */
  requiresAny?: readonly Permission[];
  /** Other addresses that are still this screen (an older route kept alive). */
  aliases?: string[];
  /**
   * The change-history scope this screen's saves are written under
   * (`GET /api/v1/settings/changes?scope=`). Defaults to the item's id; the
   * Etapa 2 screens use the name of their settings endpoint
   * (/api/v1/settings/<scope>) - the backend may file them under another
   * prefix, and then the panel under the page simply stays empty or hidden.
   *
   * `null` = this screen's saves are NOT written to the settings history at all
   * (they go to the audit log instead: e-mail templates, document kinds and rules,
   * the questionnaire, site content, accounts). The "Poslední změny" panel is then
   * left off the page and the history filter does not offer it - a panel that says
   * "nobody has changed anything" about a screen somebody just changed is a lie.
   * Measured against the dev API on 2026-10-20: the history stores a setting under
   * the first word(s) of its key (`booking.reminderHoursBefore`, `consent`,
   * `registration.quick`, `media`, `patients`, `company`, `integrations`).
   */
  scope?: string | null;
}

export interface SettingsSection {
  id: string;
  area: SettingsArea;
  label: string;
  /** What this whole group is for, in the words somebody would use. */
  description: string;
  icon: SettingsGroupIcon;
  items: SettingsItem[];
}


/** An item as written in the list below; `area` is filled in from its section. */
type RawItem = Omit<SettingsItem, 'area'>;
type RawSection = Omit<SettingsSection, 'items' | 'area'> & { area: SettingsArea; items: RawItem[] };

const RAW_SECTIONS: RawSection[] = [
  {
    /*
     * Running the week, first: the hours, the pauses, the days the clinic is
     * shut, who is away, how the calendar grid is drawn, the calendars
     * themselves and the clinic's own details.
     */
    id: 'provoz',
    area: 'daily',
    label: 'Provoz',
    description: 'Kdy se pracuje, kdy ne, jak se kreslí kalendář a kdo je ordinace',
    icon: 'provoz',
    items: [
      {
        id: 'pracovni-doba',
        common: true,
        label: 'Otevírací doba',
        description: 'Hodiny podle dnů v týdnu, obědová pauza, kdo slouží a co se který den dělá',
        to: '/working-hours',
        keywords: ['oběd', 'obědová pauza', 'polední pauza', 'pauza', 'hodiny', 'pracovní doba', 'ordinační hodiny', 'směny', 'kdo slouží', 'otevřeno', 'zavírací doba', 'rozvrh'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * The regular lunch break is a column of the working hours; the
         * one-off pauses - a serviced device, a meeting, a course - are
         * blocked time, and that is the screen that holds them. Open to
         * everybody signed in, as blocking time is.
         */
        id: 'blokovany-cas',
        common: true,
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
        common: true,
        label: 'Svátky a dovolené',
        description: 'Státní svátky, dny kdy přesto pracujeme, a vlastní volno ordinace',
        to: '/svatky',
        keywords: ['svátek', 'státní svátek', 'dovolená', 'volno', 'zavřeno', 'prázdniny', 'dny volna'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'nepritomnosti',
        common: true,
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
        id: 'zmeny-rezervaci',
        label: 'Lhůta pro změny pacientem',
        description: 'Do kdy před začátkem si pacient může termín přesunout nebo zrušit',
        to: '/nastaveni/zmeny-rezervaci',
        keywords: ['lhůta', 'změna termínu', 'zrušení', 'storno', 'přesunout', 'pacient zruší', 'hodin předem'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'dochazka',
        label: 'Docházka',
        description: 'Po kolika minutách se objednávka označí jako „asi nepřišel“',
        to: '/nastaveni/dochazka',
        keywords: ['nepřišel', 'neomluvená', 'docházka', 'no show', 'pozdní příchod', 'minut'],
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
        common: true,
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
     * What the clinic does and what it costs. The board's "Délky a kapacity"
     * is the činnosti screen itself (a činnost is its length), so it is one
     * row, not two rows to one screen.
     */
    id: 'sluzby-a-ceny',
    area: 'daily',
    label: 'Služby a ceny',
    description: 'Co ordinace nabízí, jak dlouho to trvá, co to stojí a jakou barvu to má',
    icon: 'sluzby',
    items: [
      {
        id: 'sluzby',
        common: true,
        label: 'Služby',
        description: 'Co ordinace dělá — činnosti patří pod službu a kalendář službu provozuje',
        to: '/nastaveni/sluzby',
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
        common: true,
        label: 'Ceník',
        description: 'Co ordinace účtuje — odsud si činnost bere svou cenu',
        to: '/nastaveni/cenik',
        keywords: ['ceny', 'cena', 'kč', 'ceník', 'položka', 'položky', 'kolik stojí', 'sazba', 'účtování'],
      },
      {
        id: 'slevy',
        label: 'Slevy a cenové hladiny',
        description: 'Čím víc lidí přijde společně, tím větší sleva — hladiny podle počtu osob, balíčky a limity ručních slev',
        to: '/nastaveni/slevy',
        scope: 'discounts',
        /* The older, tiers-only screen stays reachable until the new one replaces it. */
        aliases: ['/nastaveni/skupinove-slevy'],
        keywords: ['sleva', 'slevy', 'procenta', '%', 'hladina', 'cenové hladiny', 'skupina', 'klub', 'množstevní', 'balíček'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'barvy-sluzeb',
        label: 'Barvy',
        description: 'Barva plánovače, každé služby, činnosti i kalendáře (z palety, nebo vlastní, s náhledem a návratem k výchozí) a paleta, ze které se nové služby barví samy — stejná v kalendáři, legendách i štítcích',
        to: '/nastaveni/barvy-sluzeb',
        scope: 'service-colors',
        keywords: ['barva', 'barvy', 'paleta', 'odstín', 'legenda', 'kalendář', 'služba', 'činnost', 'plánovač', 'modrá', 'zvýraznění'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * What the clinic says to people and what the patient fills in and signs. Templates, the clinic's own messages, the
     * calendar file, the reminder and the sending status are ONE screen, Zprávy (it replaced Šablony, E-mail and
     * Připomínky; their addresses are aliases). The e-mail queue is administration (see below).
     */
    id: 'komunikace-a-dokumenty',
    area: 'daily',
    label: 'Komunikace a dokumenty',
    description: 'Zprávy pacientům a klubům, dotazník, souhlasy a to, co pacient dokládá',
    icon: 'komunikace',
    items: [
      {
        id: 'zpravy',
        common: true,
        label: 'Zprávy',
        description: 'E-maily pacientům a klubům: zapnout, upravit nebo napsat vlastní, upozornění v kalendáři, připomínky a odesílání',
        to: '/nastaveni/zpravy',
        aliases: ['/nastaveni/sablony-emailu', '/nastaveni/email', '/nastaveni/pripominky'],
        scope: 'booking.reminderHoursBefore',
        requiresAny: ['communication.manage', 'settings.clinic.manage'],
        keywords: ['email', 'e-mail', 'sms', 'šablona', 'šablony', 'šablony zpráv', 'text zprávy', 'zpráva', 'potvrzení', 'předmět', 'testovací odeslání', 'notifikace', 'vlastní zpráva', 'hromadná zpráva', 'posun dne', 'hráči', 'kalendář', 'alarm', 'smtp', 'brevo', 'odesílání', 'poskytovatel', 'spf', 'dkim', 'dmarc', 'doména', 'zkušební e-mail', 'fronta', 'připomínka', 'připomenutí', 'upomínka', 'hodin před termínem'],
      },
      {
        id: 'hodnoceni-pacientu',
        label: 'Hodnocení pacientů',
        description: 'Co pacienti napsali po dokončené návštěvě — soukromé, nic se nezveřejňuje',
        to: '/hodnoceni-pacientu',
        scope: null,
        keywords: ['hodnocení', 'recenze', 'zpětná vazba', 'feedback', 'spokojenost', 'hvězdičky'],
      },
      {
        /*
         * The questions a patient actually answers. They lived in the browser
         * bundle until 21. 9. 2026, so adding one meant a developer and a
         * deploy. This is the screen that ended that.
         */
        id: 'zdravotni-dotaznik',
        common: true,
        label: 'Vstupní dotazník',
        description: 'Dotazníky pro pacienty — nový dotazník, otázky, zapnutí a vypnutí a který je výchozí',
        to: '/dotaznik-nastaveni',
        scope: null,
        keywords: ['dotazník', 'anamnéza', 'otázky', 'otázka', 'zdravotní dotazník', 'vstupní dotazník', 'formulář'],
        requires: 'questionnaires.manage',
      },
      {
        /*
         * Above the rules, because a rule points at one of these and the
         * owner met them in the wrong order.
         */
        id: 'dokumenty-sablony',
        common: true,
        label: 'Dokumenty, šablony a hlavičky',
        description: 'Druhy dokumentů, které ordinace vede — název, popis a co se používá',
        to: '/dokumenty-sablony',
        scope: null,
        keywords: ['dokument', 'dokumenty', 'hlavička', 'hlavičky', 'druh dokumentu', 'výpis', 'potvrzení', 'lékařská zpráva', 'šablona dokumentu'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'pravidla-dokumentu',
        label: 'Pravidla dokumentů',
        description: 'Co musí pacient doložit a ke které službě — činnosti pod ní to dědí',
        to: '/pravidla-dokumentu',
        scope: null,
        keywords: ['dokument', 'pravidlo', 'doložit', 'povinné dokumenty', 'výpis', 'ke které službě', 'co pacient přinese'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'udaje-pacienta',
        label: 'Údaje pacienta',
        description: 'Které údaje karta a seznam pacientů ukazují a v jakém pořadí',
        to: '/nastaveni/udaje-pacienta',
        scope: 'patients',
        keywords: ['pacient', 'karta', 'pole', 'sloupce', 'údaje', 'pořadí', 'rodné číslo', 'pojišťovna', 'seznam pacientů'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'rychla-registrace',
        label: 'Rychlá registrace',
        description: 'Jak dlouho platí dokončovací odkaz po objednání u přepážky, kdy se připomene a zda se žádá datum narození',
        to: '/nastaveni/rychla-registrace',
        scope: 'registration.quick',
        keywords: ['rychlá registrace', 'dokončení registrace', 'odkaz', 'lhůta', 'platnost', 'datum narození', 'hodin', 'přepážka', 'recepce'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * The other registration link: the personal one the desk e-mails a patient to finish
         * his own details. The server read all four of its settings from the start (lifetime,
         * e-mail subject and text, the web address the link is built on) and told the desk to
         * set the address "v Nastavení"; no screen existed, so it could not be set.
         */
        id: 'odkaz-registrace',
        label: 'Odkaz k dokončení registrace',
        description: 'Jak dlouho platí osobní odkaz pro pacienta, jak zní e-mail s ním a na jaké adrese webu se odkaz skládá',
        to: '/nastaveni/odkaz-registrace',
        scope: 'intake',
        keywords: ['odkaz', 'osobní odkaz', 'předregistrace', 'dokončení registrace', 'e-mail s odkazem', 'adresa webu', 'platnost odkazu', 'zástupné údaje', 'recepce'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /*
     * The clubs' side of the configuration: the time held for them, the links
     * their athletes register through and the rules of those links.
     */
    id: 'kluby',
    area: 'daily',
    label: 'Kluby',
    description: 'Hromadné objednávky pro kluby, odkazy pro jejich sportovce a pravidla kolem nich',
    icon: 'kluby',
    items: [
      {
        /*
         * One item for the two names the brief gave it: "Hromadné objednávky"
         * and "Blokace pro kluby" are the same screen (PartnerOrdersPage),
         * which the club work extends with the block calculator.
         */
        id: 'blokace-klubu',
        label: 'Hromadné objednávky a blokace',
        description: 'Časy držené pro klub, registrační odkazy pro sportovce a lhůty, kdy se místa uvolní',
        to: '/vyhrazeni',
        keywords: ['klub', 'kluby', 'hromadná objednávka', 'hromadné', 'blokace', 'blokace pro kluby', 'registrační odkaz', 'odkaz pro sportovce', 'vyhrazení', 'držená místa', 'lhůta', 'faktura klubu', 'plátce'],
      },
      {
        id: 'nastaveni-klubu',
        common: true,
        label: 'Nastavení klubů',
        description: 'Jak dlouho platí registrační odkaz klubu a od kolika sportovců se upozorňuje na malou skupinu',
        to: '/nastaveni/kluby',
        scope: 'clubs',
        keywords: ['klub', 'kluby', 'platnost odkazu', 'registrační odkaz', 'minimální počet', 'sportovci', 'dny'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
  {
    /* Personal, not administrative: every signed-in user secures their own account here. */
    id: 'ucet',
    area: 'daily',
    label: 'Můj účet',
    description: 'Vaše heslo, dvoufázové ověření a přihlášená zařízení',
    icon: 'system',
    items: [
      {
        /*
         * Personal, not administrative: every signed-in user secures their
         * own account here, so no `requires`.
         */
        id: 'dvoufazove',
        label: 'Můj účet a zabezpečení',
        description: 'Dvoufázové ověření, přihlášená zařízení a odhlášení všude jinde',
        to: '/nastaveni/zabezpeceni',
        scope: null,
        keywords: ['moje heslo', 'heslo', 'relace', 'zařízení', 'odhlásit', '2fa', 'dvoufázové', 'dvoufaktorové', 'přihlášení', 'ověření', 'kód', 'authenticator', 'bezpečnost', 'účet'],
      },
    ],
  },
  {
    /*
     * Administration: who may do what, how the account is protected, the clinic's own data, the public site, the
     * connections and the records of what changed. Shown only to somebody who may manage users or the clinic
     * (`canSeeAdmin`); the rest of the app does not mention it.
     */
    id: 'administrace',
    area: 'admin',
    label: 'Administrace',
    description: 'Uživatelé a práva, zabezpečení, údaje ordinace, web, napojení a záznamy změn',
    icon: 'system',
    items: [
      {
        /*
         * One item for "Uživatelé a práva", "Tým" and "Zaměstnanci": it is
         * one screen - accounts, roles and per-person permissions - and three
         * rows to it were the "all look the same" the owner complained of.
         * The id stays `tym` for the sake of anything that remembers it.
         */
        id: 'tym',
        label: 'Uživatelé a práva',
        description: 'Tým: zaměstnanci, jejich role a oprávnění, reset hesla a vypnutí přístupu',
        to: '/staff-management',
        scope: null,
        keywords: ['tým', 'zaměstnanec', 'zaměstnanci', 'lékař', 'lékaři', 'sestra', 'recepce', 'uživatel', 'uživatelé', 'práva', 'oprávnění', 'role', 'reset hesla', 'přístup', 'nový účet'],
        requires: 'users.manage',
      },
      {
        id: 'zabezpeceni-zalohy',
        label: 'Zabezpečení a zálohy',
        description: 'Skutečný stav záloh, účtů a prostředí; odhlášení lidí, klíče pro hlášení záloh, export konfigurace a návod k obnově',
        to: '/nastaveni/zabezpeceni-a-zalohy',
        scope: null,
        keywords: ['záloha', 'zálohy', 'zálohování', 'obnova', 'backup', 'restore', 'bezpečnost', '2fa', 'dvoufázové', 'odhlásit', 'klíč', 'šifrování', 'gdpr', 'únik'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'bezpecnostni-pravidla',
        label: 'Bezpečnostní pravidla',
        description: 'Zda se má administrace znovu potvrzovat heslem, vyžadovat dvoufázové ověření nebo se po nečinnosti zamknout',
        to: '/nastaveni/bezpecnostni-pravidla',
        scope: 'security',
        keywords: ['bezpečnost', 'pravidla', 'potvrdit heslem', 'znovu potvrdit', 'dvoufázové', '2fa', 'zamknout', 'nečinnost', 'uzamčení', 'administrace', 'heslo'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'firma-a-faktury',
        label: 'Firma a faktury',
        description: 'Fakturační údaje firmy, bankovní účet, datová schránka a splatnost faktur',
        to: '/nastaveni/firma-a-faktury',
        scope: 'company',
        keywords: ['firma', 'faktura', 'faktury', 'ičo', 'dič', 'bankovní účet', 'iban', 'splatnost', 'datová schránka', 'sídlo'],
        requires: 'settings.clinic.manage',
      },
      {
        /* Who the clinic is: name, contacts, what the public sees. */
        id: 'verejny-web',
        label: 'Údaje ordinace',
        description: 'Název, adresa, telefon, firemní údaje a co se ukazuje pacientům',
        to: '/admin',
        keywords: ['ordinace', 'název', 'adresa', 'telefon', 'faktura', 'ičo', 'dič', 'plátce dph', 'firemní údaje', 'fakturační údaje', 'web', 'veřejný web', 'logo', 'kontakt'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'integrace',
        label: 'Integrace',
        description: 'Napojení na ADAM — adresa, uživatel a heslo; MEDISTAR je ukončen',
        to: '/nastaveni/integrace',
        scope: 'integrations',
        keywords: ['adam', 'medistar', 'napojení', 'integrace', 'api', 'přihlašovací údaje', 'zařízení', 'přístroj'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'media-a-texty',
        label: 'Média a texty',
        description: 'Texty, fotky a videa na veřejném webu, partneři a časté dotazy — vše bez zásahu do kódu',
        to: '/nastaveni/media-a-texty',
        scope: null,
        keywords: ['web', 'texty', 'fotky', 'video', 'obrázky', 'partneři', 'faq', 'časté dotazy', 'úvodní stránka', 'obsah'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'uloziste-medii',
        label: 'Úložiště médií',
        description: 'Kam se nahrávají fotky a videa — přístupové údaje k úložišti a zda je zapnuté',
        to: '/nastaveni/uloziste-medii',
        scope: 'media',
        keywords: ['cloudinary', 'úložiště', 'média', 'nahrávání', 'fotky', 'video', 'klíč', 'cloud'],
        requires: 'settings.clinic.manage',
      },
      {
        /*
         * Only the marketing consent is the clinic's own to show or hide and
         * to word. The treatment consent (zákon) and the per-činnost
         * report/club consents are not a screen's to switch off.
         */
        id: 'souhlasy',
        label: 'Souhlasy a GDPR',
        description: 'Marketingový souhlas na objednávkovém formuláři — zda se ukáže a jak zní; zákonné souhlasy zůstávají vždy zapnuté',
        to: '/nastaveni/souhlasy',
        scope: 'consent',
        keywords: ['souhlas', 'gdpr', 'marketing', 'marketingový souhlas', 'podpis', 'objednávkový formulář', 'newsletter'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'fronta-emailu',
        label: 'Fronta e-mailů',
        description: 'Které e-maily čekají, odešly nebo selhaly; selhané jde odeslat znovu nebo zrušit',
        to: '/nastaveni/fronta-emailu',
        scope: null,
        requires: 'settings.clinic.manage',
        keywords: ['fronta', 'e-maily', 'email', 'neodešlo', 'selhalo', 'odeslat znovu', 'zrušit odeslání', 'odchozí pošta', 'outbox'],
      },
      {
        id: 'historie-zmen',
        label: 'Historie změn',
        description: 'Kdo kdy změnil které nastavení — z jaké hodnoty na jakou, s filtrem podle oblasti, data a uživatele',
        to: '/nastaveni/historie-zmen',
        scope: null,
        keywords: ['historie', 'změny', 'kdo změnil', 'před a po', 'záznam změn', 'kdy', 'nastavení'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'audit',
        label: 'Auditní log',
        description: 'Kdo co změnil a kdy — včetně přístupů k citlivým údajům',
        to: '/audit-log',
        scope: null,
        keywords: ['audit', 'log', 'kdo co změnil', 'protokol', 'záznam', 'přístupy'],
        requires: 'settings.clinic.manage',
      },
      {
        id: 'zdravi',
        label: 'Zdraví systému',
        description: 'Chyby, přihlášená zařízení a stav služeb',
        to: '/system-health',
        scope: null,
        keywords: ['chyby', 'stav systému', 'zařízení', 'přihlášená zařízení', 'server', 'health', 'diagnostika systému'],
        requires: 'settings.clinic.manage',
      },
    ],
  },
];

/** Every section, each item stamped with its section's area. */
export const SETTINGS_SECTIONS: SettingsSection[] = RAW_SECTIONS.map((section) => ({
  ...section,
  items: section.items.map((item) => ({ ...item, area: section.area })),
}));

/** May this person see the Administrace at all? Nobody else is told it exists. */
export function canSeeAdmin(held: ReadonlySet<string> | readonly string[]): boolean {
  const has = held instanceof Set ? (p: string) => held.has(p) : (p: string) => (held as readonly string[]).includes(p);
  return ADMIN_PERMISSIONS.some(has);
}

/**
 * The settings this person may actually open, optionally of one area.
 *
 * Takes the effective permissions the SERVER sent at sign-in: the role's
 * defaults with that person's own grants and revocations already applied. The
 * Owner holds every permission, so the Owner sees every item.
 *
 * The Administrace is one more gate on top of an item's own: without
 * `users.manage` or `settings.clinic.manage` NONE of its items is returned, so
 * no menu, search or palette built from this ever mentions it.
 *
 * A section left with nothing in it disappears rather than standing empty — a
 * heading over no rows reads like a screen that failed to load.
 *
 * It hides; it does not protect. `localStorage` is the viewer's to edit, and
 * the server refuses these screens on its own account.
 */
export function visibleSections(
  held: ReadonlySet<string> | readonly string[],
  area?: SettingsArea,
): SettingsSection[] {
  const permissions = held instanceof Set ? held : new Set(held);
  const admin = canSeeAdmin(permissions);

  return SETTINGS_SECTIONS
    .filter((section) => (area === undefined || section.area === area) && (section.area !== 'admin' || admin))
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (item.requires === undefined || permissions.has(item.requires)) &&
          (item.requiresAny === undefined || item.requiresAny.some((p) => permissions.has(p))),
      ),
    }))
    .filter((section) => section.items.length > 0);
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
 *
 * `extra` is text the caller knows about the row and the catalogue does not -
 * a current value ("14 %") - searched like the description.
 */
function rankItem(
  item: SettingsItem,
  section: SettingsSection,
  words: string[],
  extra = '',
): SettingsHit['rank'] | null {
  const label = normalizeText(item.label);
  const keywords = normalizeText(item.keywords.join(' '));
  const rest = normalizeText(`${item.description} ${section.label} ${section.description} ${extra}`);
  if (words.every((w) => label.includes(w))) return 0;
  if (words.every((w) => label.includes(w) || keywords.includes(w))) return 1;
  if (words.every((w) => label.includes(w) || keywords.includes(w) || rest.includes(w))) return 2;
  return null;
}

/**
 * Every row that answers a query, best first - what the hub and the Ctrl+K
 * palette list. Within one rank the catalogue's own order holds, so the
 * groups stay in the order they are drawn. `values` maps an item id to text
 * about its current value, when the caller has some at hand.
 */
export function searchSettingsItems(
  sections: SettingsSection[],
  query: string,
  values: Readonly<Record<string, string>> = {},
): SettingsHit[] {
  const words = normalizeText(query).split(' ').filter((w) => w !== '');
  if (words.length === 0) {
    return sections.flatMap((section) => section.items.map((item) => ({ item, section, rank: 2 as const })));
  }
  const hits: SettingsHit[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const rank = rankItem(item, section, words, values[item.id] ?? '');
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

/** The address of an area's page. */
export const AREA_PATH: Record<SettingsArea, string> = { daily: '/nastaveni', admin: '/administrace' };
export const AREA_LABEL: Record<SettingsArea, string> = { daily: 'Nastavení', admin: 'Administrace' };

export function areaPath(area: SettingsArea): string {
  return AREA_PATH[area];
}

/**
 * Where an old /settings/:group address now lives. The groups that held administration go to the Administrace page
 * (a person without the right gets the ordinary "no access" there), every other one - and any unknown id - to Nastavení.
 */
export function legacyGroupPath(groupId: string | undefined): string {
  return groupId === 'system' || groupId === 'vzhled-webu' || groupId === 'administrace' ? AREA_PATH.admin : AREA_PATH.daily;
}

/** The area a section stands in, by its id; null if unknown. */
export function sectionById(id: string | undefined): SettingsSection | null {
  if (id === undefined) return null;
  return SETTINGS_SECTIONS.find((s) => s.id === id) ?? null;
}

/** The page of the area a section stands in - what "back" means from one of its screens. */
export function groupPath(sectionId: string): string {
  return AREA_PATH[sectionById(sectionId)?.area ?? 'daily'];
}

/** The change-history scope an item's saves are written under. */
export function scopeOf(item: SettingsItem): string | null {
  return item.scope === undefined ? item.id : item.scope;
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
 * its way back. An item's `aliases` count as the screen too.
 */
export function settingsItemAt(
  pathname: string,
): { item: SettingsItem; section: SettingsSection } | null {
  for (const section of SETTINGS_SECTIONS) {
    for (const item of section.items) {
      for (const address of [item.to, ...(item.aliases ?? [])]) {
        if (pathname === address || pathname.startsWith(`${address}/`)) {
          return { item, section };
        }
      }
    }
  }
  return null;
}

/** Is this one of the two plain pages (Nastavení, Administrace) - where the page itself is the list and no side list is drawn? */
export function isAreaHub(pathname: string): boolean {
  return pathname === AREA_PATH.daily || pathname === AREA_PATH.admin;
}

/**
 * Which area an address belongs to: the Administrace page and every admin screen are 'admin', Nastavení and every
 * other settings screen are 'daily', anything else is null.
 */
export function areaAt(pathname: string): SettingsArea | null {
  if (pathname === AREA_PATH.admin || pathname.startsWith(AREA_PATH.admin + '/')) return 'admin';
  const here = settingsItemAt(pathname);
  if (here !== null) return here.item.area;
  if (pathname === '/settings' || pathname.startsWith('/settings/') || pathname === AREA_PATH.daily) return 'daily';
  return pathname.startsWith('/nastaveni/') ? 'daily' : null;
}

/** "1 položka", "3 položky", "7 položek" - the count on a group's tile. */
export function itemCountLabel(count: number): string {
  if (count === 1) return '1 položka';
  if (count >= 2 && count <= 4) return `${count} položky`;
  return `${count} položek`;
}