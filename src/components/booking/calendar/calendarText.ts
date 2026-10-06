/*
 * The Czech words the Etapa 2 calendar adds (panels, range selection, the
 * phone and tablet chrome). Literal strings, as the brief asks - no new i18n
 * keys - kept beside the calendar so the locale file is not touched.
 */
export const CAL_TEXT = {
  /* month panel */
  nobody: "Bez rezervací",
  otherService: "Ostatní",
  openDay: "Otevřít den",
  startRange: "Vybrat od tohoto dne",
  closePanel: "Zavřít",
  holiday: "Státní svátek",
  closedDay: "Zavřeno",

  /* range selection */
  rangeMode: "Vybrat dny",
  rangeModeHint: "Klepněte na první a pak na poslední den.",
  rangeModeFirst: "Klepněte na poslední den výběru.",
  rangeTitle: "Výběr dnů",

  /* several different places at once */
  multiMode: "Vybrat víc termínů",
  trayLabel: "Vybrané termíny",
  trayCount: (n: number) => (n === 1 ? "1 termín" : n >= 2 && n <= 4 ? `${n} termíny` : `${n} termínů`),
  trayRemove: (label: string) => `Odebrat termín ${label}`,
  trayPast: "v minulosti",
  trayExpand: "Zobrazit termíny",
  trayCollapse: "Skrýt termíny",
  multiHint: "Další termín přidáte tažením s klávesou Ctrl, ⌘ nebo Shift.",
  rangeBookHint: "Od prvního dne výběru",
  rangeBlockHint: "Celé dny, pauza, dovolená, školení",
  clubBlockLabel: (club: string) => `Blok · ${club}`,

  /* tablet / phone chrome */
  filters: "Kalendář a filtry",
  filtersClose: "Zavřít",
  calendarsFilter: "Kalendáře",
  services: "Služby",
  serviceOnly: "Zobrazit jen tuto službu",
  nothingToShow: "Podle zvolených filtrů se nic nezobrazuje.",
  noBookings: "Žádné rezervace",
  previousDay: "Předchozí den",
  nextDay: "Další den",
  weekStrip: "Dny týdne",
  dayList: "Seznam rezervací dne",
  monthList: "Dny měsíce",
  tapDayHint: "Klepnutím otevřete den",
  newAppointment: "Nová objednávka",

  /* a click on a club's block */
  clubPopover: {
    title: (club: string) => `Blok pro ${club}`,
    open: "Otevřít blok",
    close: "Zavřít",
    /* A window that belongs to a club order opens the ORDER, never the block. */
    orderTitle: (code: string, club: string) => `Objednávka ${code} · ${club}`,
    openOrder: "Otevřít objednávku",
    editTerms: "Upravit termíny",
    loading: "Načítám objednávku…",
    orderHint: "Čas drží klub – běžné objednávky sem nejdou. Označený je termín, na který jste klepli.",
    hint: "Čas drží klub – běžné objednávky sem nejdou. Sportovci se do něj registrují přes odkaz klubu.",
  },

  /* moving a booking by dragging it */
  moveTitle: "Přesunout rezervaci",
  moveFrom: "Z",
  moveTo: "Na",
  moveBack: "Zpět",
  moveConfirm: "Přesunout",
} as const;
