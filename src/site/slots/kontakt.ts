import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /web/kontakt (artboard V-Kontakt). The phone, e-mail, address and opening hours
 * come from the clinic's own settings (GET /api/public/clinic) and, when the clinic has none, from the
 * shared `site.footer.*` slots — they are NOT repeated here. These are the sentences around them.
 * Defaults are the clinic's published website (checked 2026-10-03).
 */

const HERO = 'Kontakt › Úvod';
const CARDS = 'Kontakt › Telefon, e-mail, adresa';
const MAP = 'Kontakt › Mapa';
const WAY = 'Kontakt › Jak se k nám dostanete';
const HOURS = 'Kontakt › Otevírací doba';
const ASK = 'Kontakt › Dotaz a poptávka';
const BILL = 'Kontakt › Fakturační údaje';

export const kontaktSlots: SlotDef[] = [
  textSlot('kontakt.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Kontakt'),
  textSlot('kontakt.hero.title', 'Úvod — titulek stránky', HERO, 'Najdete nás v Michli'),
  textSlot(
    'kontakt.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Budova GreenLine, páté patro. Jihlavská 1558/21, Praha 4. Provoz podle objednání, takže se nejdřív objednejte.',
    { multiline: true },
  ),
  textSlot('kontakt.hero.cta.book', 'Úvod — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('kontakt.hero.cta.prices', 'Úvod — druhé tlačítko', HERO, 'Ceník'),
  mediaSlot('kontakt.hero.photo', 'Úvod — foto', HERO, 'budova GreenLine zvenku', '1600 × 1000 px', '16 / 10'),

  textSlot('kontakt.phone.label', 'Telefon — štítek', CARDS, 'Telefon'),
  textSlot('kontakt.phone.note', 'Telefon — poznámka', CARDS, 'Provoz podle objednání'),
  textSlot('kontakt.email.label', 'E-mail — štítek', CARDS, 'E-mail'),
  textSlot('kontakt.email.note', 'E-mail — poznámka', CARDS, 'Odpovídáme do jednoho pracovního dne'),
  textSlot('kontakt.address.label', 'Adresa — štítek', CARDS, 'Adresa'),
  textSlot('kontakt.address.note', 'Adresa — poznámka (zobrazí se, když adresa z nastavení kliniky nezmiňuje budovu)', CARDS, 'Budova GreenLine, 5. patro'),

  mediaSlot('kontakt.map.image', 'Mapa — obrázek (snímek mapy, volitelné)', MAP, 'Jihlavská 1558/21, Praha 4 — Michle', '1600 × 640 px', '5 / 2'),
  textSlot('kontakt.map.cta', 'Mapa — tlačítko (otevře Mapy.cz v novém okně)', MAP, 'Otevřít na Mapy.cz'),

  textSlot('kontakt.way.title', 'Jak se k nám dostanete — titulek sekce', WAY, 'Jak se k nám dostanete'),
  textSlot('kontakt.way.metro.title', 'Metro — název', WAY, 'Metro'),
  textSlot('kontakt.way.metro.text', 'Metro — popis', WAY, 'Linka C, stanice Kačerov.'),
  textSlot('kontakt.way.bus.title', 'Autobus — název', WAY, 'Autobus'),
  textSlot('kontakt.way.bus.text', 'Autobus — popis', WAY, 'Zastávky Lísek a Kačerov.'),
  textSlot('kontakt.way.train.title', 'Vlak — název', WAY, 'Vlak'),
  textSlot('kontakt.way.train.text', 'Vlak — popis', WAY, 'Stanice Praha-Kačerov.'),
  textSlot('kontakt.way.car.title', 'Autem — název', WAY, 'Autem'),
  textSlot('kontakt.way.car.text', 'Autem — popis (parkování doplňte, až bude jisté)', WAY, 'Po Magistrále nebo po Jižní spojce.'),
  textSlot('kontakt.way.building.title', 'V budově — název', WAY, 'V budově'),
  textSlot('kontakt.way.building.text', 'V budově — popis', WAY, 'Recepce v přízemí, výtahem do 5. patra.'),

  textSlot('kontakt.hours.title', 'Otevírací doba — titulek sekce', HOURS, 'Otevírací doba'),
  textSlot('kontakt.hours.note', 'Otevírací doba — poznámka pod tabulkou', HOURS, 'Provoz podle objednání — bez rezervace vás nemusíme zastihnout.', { multiline: true }),

  textSlot('kontakt.ask.title', 'Dotaz — titulek', ASK, 'Máte dotaz?'),
  textSlot(
    'kontakt.ask.text',
    'Dotaz — text',
    ASK,
    'Zavolejte nebo napište. Termín na vyšetření si nejrychleji vyberete online; kluby a týmy se mohou ozvat s poptávkou.',
    { multiline: true },
  ),
  textSlot('kontakt.ask.cta.call', 'Dotaz — tlačítko „Zavolat“', ASK, 'Zavolat'),
  textSlot('kontakt.ask.cta.mail', 'Dotaz — tlačítko „Napsat“', ASK, 'Napsat e-mail'),
  textSlot('kontakt.ask.cta.clubs', 'Dotaz — odkaz pro kluby', ASK, 'Poptávka pro kluby'),

  textSlot('kontakt.billing.title', 'Fakturační údaje — titulek sekce', BILL, 'Fakturační údaje'),
  textSlot('kontakt.billing.name.label', 'Název — štítek', BILL, 'Název'),
  textSlot('kontakt.billing.name.value', 'Název — hodnota', BILL, 'SportMedical Diagnostics s.r.o.'),
  textSlot('kontakt.billing.ico.label', 'IČO — štítek', BILL, 'IČO'),
  textSlot('kontakt.billing.ico.value', 'IČO — hodnota', BILL, '23351632'),
  textSlot('kontakt.billing.seat.label', 'Sídlo — štítek', BILL, 'Sídlo'),
  textSlot('kontakt.billing.seat.value', 'Sídlo — hodnota', BILL, 'Krátká 283\n252 65 Tursko', { multiline: true }),
  textSlot('kontakt.billing.site.label', 'Provozovna — štítek', BILL, 'Provozovna'),
  textSlot('kontakt.billing.site.value', 'Provozovna — hodnota', BILL, 'GreenLine, 5. patro\nJihlavská 1558/21\n140 00 Praha 4 — Michle', { multiline: true }),
  textSlot('kontakt.billing.databox.label', 'Datová schránka — štítek', BILL, 'Datová schránka'),
  textSlot('kontakt.billing.databox.value', 'Datová schránka — hodnota', BILL, 'fdcgvvp'),
];
