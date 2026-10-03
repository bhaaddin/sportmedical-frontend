import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /web/dokumenty (artboard V-Dokumenty).
 *
 * Every document is three text slots: title, description and the address of the file. The address
 * is a text slot on purpose — the admin pastes the link of the PDF (or clears it, and the entry
 * says "Připravujeme" until the file exists). The defaults are the PDFs the clinic's current website
 * publishes (checked 2026-10-03), so the page is complete on the day it goes live.
 */

const HERO = 'Dokumenty › Úvod';
const SECTIONS = {
  required: 'Dokumenty › Povinné před vyšetřením',
  guides: 'Dokumenty › Informace k vyšetřením',
  clubs: 'Dokumenty › Pro kluby',
} as const;
const PORTAL = 'Dokumenty › Portál';

export type DocumentSection = keyof typeof SECTIONS;

export interface DocumentEntry {
  /** Part of the slot keys: `dokumenty.<section>.<id>.title|text|url`. */
  id: string;
  section: DocumentSection;
  title: string;
  text: string;
  /** Default address of the file; '—' = not published yet ("Připravujeme"). An empty text cannot be saved in the admin, so the dash is also how a file is taken down. */
  url: string;
  /** A page of this site instead of a file (no URL slot). */
  to?: string;
}

const SHOPIFY = 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/';

export const DOCUMENT_ENTRIES: readonly DocumentEntry[] = [
  {
    id: 'vypis', section: 'required', title: 'Výpis ze zdravotní dokumentace',
    text: 'Ze zákona povinný. Vyžádejte si ho u svého praktického lékaře; bez něj nelze vystavit posudek.',
    url: `${SHOPIFY}VYPIS_ze_zdravtni_dokumentace.pdf?v=1780562021`,
  },
  {
    id: 'dotaznik', section: 'required', title: 'Zdravotní dotazník',
    text: 'Vyplňte předem z pohodlí domova a urychlete tím průběh vyšetření. Online ho vyplníte i přes odkaz po objednání.',
    url: `${SHOPIFY}zdravotni_dotaznik.pdf?v=1780561779`,
  },
  {
    id: 'gdpr', section: 'required', title: 'Souhlas pacienta (GDPR)',
    text: 'Souhlas se zpracováním osobních údajů, vyplňuje se při první návštěvě.',
    url: `${SHOPIFY}GDPR_final.pdf?v=1780561628`,
  },
  {
    id: 'informovany', section: 'required', title: 'Informovaný souhlas s vyšetřením',
    text: 'Souhlas s provedením vyšetření.',
    url: '—',
  },
  {
    id: 'zastupce', section: 'required', title: 'Souhlas zákonného zástupce',
    text: 'U sportovců mladších 18 let, kteří přijdou bez doprovodu.',
    url: `${SHOPIFY}Souhlas_zakonneho_zastupce_3ff9ec9a-fe46-4e0f-8fd0-2fae5adce636.pdf?v=1780561681`,
  },
  {
    id: 'prohlidky', section: 'guides', title: 'Sportovní lékařské prohlídky – doporučení',
    text: 'Souhrn praktických informací k účelu, přípravě a průběhu zátěžového vyšetření.',
    url: `${SHOPIFY}Informace_pro_pacienta_-_SPORTOVNI_LEKARSKE_PROHLIDKY_8d9a3bc7-2396-403c-8d63-8368a8ef6d29.pdf?v=1780564931`,
  },
  {
    id: 'diagnostika', section: 'guides', title: 'Sportovní diagnostika – doporučení',
    text: 'Jak se připravit na měření na silových deskách, 3D analýzu pohybu a VO₂max.',
    url: `${SHOPIFY}Informace_pro_pacienta_Sportovni_diagnostika.pdf?v=1769076502`,
  },
  {
    id: 'inbody', section: 'guides', title: 'InBody měření – doporučení',
    text: 'Jak se připravit, aby bylo měření tělesného složení srovnatelné.',
    url: `${SHOPIFY}Informace_pro_pacienta_InBody_971717d8-51ee-4e1f-8011-cb13018d3178.pdf?v=1780564468`,
  },
  {
    id: 'inbody-vysledky', section: 'guides', title: 'Jak číst výsledky InBody',
    text: 'Vysvětlení hodnot z protokolu.',
    url: '—',
  },
  {
    id: 'objednavka', section: 'clubs', title: 'Hromadná objednávka — jak to funguje',
    text: 'Postup od poptávky po registrační odkaz pro sportovce.',
    url: '', to: '/kluby',
  },
  {
    id: 'seznam', section: 'clubs', title: 'Seznam sportovců — tabulka',
    text: 'Předvyplněná tabulka k odeslání před výjezdem.',
    url: '—',
  },
];

export const documentKey = (entry: Pick<DocumentEntry, 'id' | 'section'>, part: 'title' | 'text' | 'url'): string =>
  `dokumenty.${entry.section}.${entry.id}.${part}`;

const sectionTitle = (section: DocumentSection) => ({
  required: 'Povinné před vyšetřením',
  guides: 'Informace k jednotlivým vyšetřením',
  clubs: 'Pro kluby',
}[section]);

export const dokumentySlots: SlotDef[] = [
  textSlot('dokumenty.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Dokumenty k testům'),
  textSlot('dokumenty.hero.title', 'Úvod — titulek stránky', HERO, 'Co si přinést a co vyplnit'),
  textSlot(
    'dokumenty.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Vše potřebné ke stažení. Vstupní dotazník vyplňujete online přes odkaz, který dostanete po objednání.',
    { multiline: true },
  ),
  mediaSlot('dokumenty.hero.photo', 'Úvod — foto', HERO, 'dokumenty na recepci', '1600 × 1000 px', '16 / 10'),
  textSlot('dokumenty.soon.label', 'Štítek u dokumentu, který ještě není ke stažení', HERO, 'Připravujeme'),

  ...(['required', 'guides', 'clubs'] as const).flatMap((section): SlotDef[] => [
    textSlot(`dokumenty.${section}.title`, `${sectionTitle(section)} — titulek sekce`, SECTIONS[section], sectionTitle(section)),
    ...DOCUMENT_ENTRIES.filter((entry) => entry.section === section).flatMap((entry): SlotDef[] => [
      textSlot(documentKey(entry, 'title'), `${entry.title} — název`, SECTIONS[section], entry.title),
      textSlot(documentKey(entry, 'text'), `${entry.title} — popis`, SECTIONS[section], entry.text, { multiline: true }),
      ...(entry.to === undefined
        ? [textSlot(documentKey(entry, 'url'), `${entry.title} — odkaz na soubor („—“ = Připravujeme)`, SECTIONS[section], entry.url)]
        : []),
    ]),
  ]),

  textSlot('dokumenty.portal.text', 'Portál — věta', PORTAL, 'Dokumenty, které jste nám už odevzdali, najdete po přihlášení ve svém portálu.', { multiline: true }),
  textSlot('dokumenty.portal.cta', 'Portál — tlačítko', PORTAL, 'Otevřít portál'),
];
