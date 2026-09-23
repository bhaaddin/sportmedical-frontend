/*
 * The Czech words the calendar grid adds.
 *
 * Kept beside the grid rather than in `cs.json` because three teams change
 * the calendar screens at once tonight and the locale file is the one place
 * all three would touch; a module of their own keeps the merge clean. Moving
 * them into `cs.json` later is a mechanical change.
 */
export const GRID_TEXT = {
  book: 'Objednat',
  block: 'Zablokovat',
  blockTitle: 'Zablokovat čas',
  blockReason: 'Důvod blokace',
  blockReasonHelp: 'Zobrazí se v kalendáři u zablokovaného času.',
  blocked: 'Blokováno',
  blockDetailTitle: 'Zablokovaný čas',
  unblock: 'Zrušit blokaci',
  unblockConfirm: 'Blokace se zruší a čas bude znovu volný k objednání.',
  cancel: 'Zpět',
  close: 'Zavřít',
  newBooking: 'Nové objednání',
  publicHoliday: 'Státní svátek',
  holidayWorked: 'Svátek – pracuje se',
  closed: 'Zavřeno',
  notAWorkingDay: 'Nepracovní den',
  noPeriod: 'Mimo období',
  noActivities: 'Bez činností',
  onlineBookingOff: 'Online objednávky vypnuty',
  onlineBookingOffWhy:
    'Pacienti se teď nemohou objednat přes web. Zapíná se v Nastavení → Veřejný web a kontakty.',
  view: 'Zobrazení',
  calendars: 'Kalendáře',
  onlyThis: 'Zobrazit jen tento kalendář',
  employees: 'Pracovníci v zobrazeném období',
  noEmployees: 'V zobrazeném období není nikdo rozepsaný.',
  allEmployees: 'Všichni pracovníci',
  employee: 'Pracovník',
  services: 'Služby',
  allServices: 'Všechny služby',
  service: 'Služba',
  jumpTo: 'Přejít na datum',
  otherWorker: 'jiný pracovník',
} as const;
