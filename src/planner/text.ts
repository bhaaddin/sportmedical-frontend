/*
 * The Czech words of the restored calendar features (club-inquiry marks on the days, the month's several-days
 * selection, the phone's list). Literal constants beside the planner, in the pattern of `CAL_TEXT` / `GRID_TEXT`: no
 * component carries a sentence of its own. What the clinic owns (names of clubs, činnosti, colours) never lands here.
 */
export const PLANNER_TEXT = {
  /* club inquiries: a club order that blocks no time yet */
  inquiry: {
    kind: 'Poptávka',
    current: 'Klub žádá',
    label: (club: string) => `Poptávka · ${club}`,
    offeredTitle: (club: string) => `${club}: nabídnuté dny, klub si ještě nevybral`,
    requestedTitle: (club: string) => `${club}: klub žádá tyto dny, objednávka čeká na zpracování`,
    /** On the week's day heading: one word and the number of clubs. */
    flag: (count: number) => (count > 1 ? `Poptávka ×${count}` : 'Poptávka'),
    flagLabel: (count: number) => (count > 1 ? `Poptávky klubů: ${count}` : 'Poptávka klubu'),
    openOrder: 'Otevřít objednávku',
    listTitle: 'Poptávky klubů tohoto dne',
  },
  /* the month: several days marked at once, and blocking whole days */
  days: {
    selectionLabel: 'Vybrané dny',
    selectedCount: (n: number) => (n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`),
    removePlace: (label: string) => `Odebrat ${label} z výběru`,
    past: 'v minulosti',
    block: 'Zablokovat dny',
    blockedTile: 'Blokováno',
    clearSelection: 'Zrušit výběr',
    hint: 'Další dny přidáte tažením s klávesou Ctrl, ⌘ nebo Shift.',
    additiveMode: 'Vybrat víc dnů',
    additiveModeHint: 'Každé klepnutí přidá den do výběru.',
    rangeMode: 'Vybrat od–do',
    rangeModeHint: 'Klepněte na první a pak na poslední den.',
    blockTitle: 'Zablokovat celé dny',
    blockDone: (n: number) => `Zablokováno: ${n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`}.`,
    pickCalendars: 'Kalendáře',
  },
  /* the phone's list */
  phone: {
    dayList: 'Seznam rezervací dne',
    weekStrip: 'Dny týdne',
    monthList: 'Dny měsíce',
    noBookings: 'Žádné rezervace',
    clubWindow: (club: string, time: string) => `${club} · ${time}`,
    wholeDay: 'Celý den',
    registered: (n: number, seats: number) => `${n}/${seats} zapsáno`,
    blocked: 'Zablokováno',
    newBooking: 'Nová objednávka',
    openDay: 'Otevřít den',
    today: 'Dnes',
  },
} as const;
