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
    clubHint: 'Klepnutím na den ho naplánujete celý. Tažením vyberete víc dnů, s klávesou Ctrl, ⌘ nebo Shift přidáte další místa.',
    planDays: 'Naplánovat vybrané dny',
    headingHint: 'Klepnutím naplánujete celý den (Shift: od posledního vzatého dne)',
    headingLabel: (day: string) => `Naplánovat celý den ${day}`,
    phoneClubHint: 'Klepnutím na den ho naplánujete celý. Vzaté dny vrátíte tlačítkem Zpět.',
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
  /*
   * The club planning guide (stage 5c): small pop-outs that say what to do next, the steps of the publish dialog, and
   * the plain sentence a refusal ends with. Plain Czech, no jargon, one sentence per idea.
   */
  guide: {
    close: 'Zavřít nápovědu',
    mute: 'Nezobrazovat',
    muteTitle: 'Přestat zobrazovat tyto nápovědy (uloží se pro vás)',
    start: {
      title: 'Jak začít',
      /* the week and day boards */
      board: 'Vyberte činnost dole a táhněte v kalendáři. Klepnutí na den v měsíci vezme celý den.',
      month: 'Vyberte činnost dole a klepněte na den: vezme se celý. Tažením vyberete víc dnů najednou.',
      phone: 'Vyberte činnost v kartách níže a klepněte na den: vezme se celý. Vzít zpět jde tlačítkem Zpět.',
      armedBoard: 'Činnost je vybraná. Teď táhněte v kalendáři přes čas termínu.',
      armedMonth: 'Činnost je vybraná. Teď klepněte na den: vezme se celý.',
    },
    strip: {
      title: 'Činností je víc, než se vejde',
      text: (hidden: number) => `Ještě ${hidden} ${hidden === 1 ? 'je' : 'jich je'} za okrajem karet. Listujte šipkou nebo tažením. Když jednu naplníte, pás se posune sám.`,
    },
    callout: {
      next: (name: string) => `Další: ${name}`,
      nextSentence: (name: string) => `Pokračujte činností ${name}. Pás karet se posune k ní.`,
      prepare: 'Připravit formulář',
      prepareSentence: 'Dál se otevře okno: vygenerujete odkaz pro klub, prohlédnete e-mail a odkaz pošlete sami.',
      review: 'Prohlédnout plán',
      close: 'Zavřít',
    },
    steps: {
      title: 'Tři kroky k odeslání',
      one: 'Odkaz vygenerován',
      two: 'Náhled e-mailu',
      three: 'Odeslat nebo zkopírovat',
      locked2: 'Nejdřív vygenerujte odkaz (krok 1).',
      locked3: 'Nejdřív si prohlédněte e-mail (krok 2).',
      now1: 'Začněte tlačítkem „Vygenerovat odkaz“.',
      now2: 'Teď si prohlédněte e-mail, který klub dostane.',
      now3: 'Zkopírujte odkaz nebo text e-mailu a pošlete ho klubu. Plánovač nic neodesílá.',
      done: 'Hotovo. Odkaz máte zkopírovaný, pošlete ho klubu.',
      state: { done: 'hotovo', current: 'teď', locked: 'čeká' },
    },
    advice: {
      needMet: 'Potřebujete ještě jeden termín? Použijte „Přidat termín navíc“.',
      lunch: 'Začněte po pauze nebo skončete před ní.',
      otherDay: 'Zvolte jiný den.',
      noFree: 'Zvolte jiný den nebo kratší úsek.',
      busy: 'Zvolte jiný čas nebo jiný den.',
      past: 'Zvolte dnešní nebo pozdější den.',
    },
  },
} as const;
