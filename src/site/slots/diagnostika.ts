import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';
import { cardSlots, heroSlots, listSlots, paraSlots, photoSlot } from '../../web/pages/services/slotFactory';
import { cardSlotDefs, lineSlotDefs } from '../../web/pages/services/content/cards';
import { DIAG_CARDS, DIAG_CARD_PREFIX, DIAG_LINES, DIAG_LINE_PREFIX } from '../../web/pages/services/content/diagCards';
import {
  DIAG_BOOKING, DIAG_CUSTOM, DIAG_FAQ, DIAG_FEATURES, DIAG_HERO, DIAG_INFO, DIAG_KEY, DIAG_PRICE, DIAG_SERVICES, DIAG_SERVICES_TITLE,
  DIAG_SERVICE_LINK, DIAG_TECH, DIAG_VIZ, DIAG_VIZ_EXTRA_PHOTO, DIAG_VIZ_TITLE,
} from '../../web/pages/services/content/diagnostika';

/*
 * Sportovní diagnostika (/diagnostika). Defaults: the wording of the live page
 * sportmedical-diagnostics.cz/pages/sportovni-diagnostika as published (Slovak words and typos
 * corrected), plus the diagnostics answers of the live FAQ. Prices are NOT here: they come from the
 * price list, matched by name; the group discounts come from the discount tiers.
 * The price cards (also drawn on /prohlidky and on the four detail pages) are registered here.
 */

const HERO = 'Diagnostika › Hero';
const SERVICES = 'Diagnostika › Naše služby';
const KEY = 'Diagnostika › Data, která promění výkon';
const TECH = 'Diagnostika › Technologie';
const VIZ = 'Diagnostika › Od vizualizace ke změně';
const FAQ = 'Diagnostika › Délka, výsledky, opakování';
const PRICE = 'Diagnostika › Ceník — karty služeb a balíčků';
const END = 'Diagnostika › Pokyny a rezervace';

const serviceSlots = DIAG_SERVICES.flatMap((service, index): SlotDef[] => {
  const n = index + 1;
  return [
    textSlot(`diagnostika.service.${n}.title`, `Služba ${n} — název`, SERVICES, service.title),
    textSlot(`diagnostika.service.${n}.text`, `Služba ${n} — krátký popis`, SERVICES, service.text, { multiline: true }),
    ...(service.feature !== undefined ? [textSlot(`diagnostika.service.${n}.feature`, `Služba ${n} — klíčová vlastnost`, SERVICES, service.feature, { multiline: true })] : []),
    textSlot(`diagnostika.service.${n}.description`, `Služba ${n} — popis`, SERVICES, service.description, { multiline: true }),
    mediaSlot(`diagnostika.service.${n}.photo`, `Služba ${n} — foto`, SERVICES, service.photoCaption, '1200 × 800 px', '3 / 2'),
  ];
});

const vizSlots = DIAG_VIZ.flatMap((viz, index): SlotDef[] => {
  const n = index + 1;
  return [
    textSlot(`diagnostika.viz.${n}.title`, `Vizualizace ${n} — titulek`, VIZ, viz.title),
    textSlot(`diagnostika.viz.${n}.text`, `Vizualizace ${n} — krátký popis`, VIZ, viz.text, { multiline: true }),
    ...(viz.long !== undefined ? [textSlot(`diagnostika.viz.${n}.long`, `Vizualizace ${n} — podrobný popis`, VIZ, viz.long, { multiline: true })] : []),
    photoSlot(`diagnostika.viz.${n}.photo`, `Vizualizace ${n} — foto`, VIZ, viz.photoCaption),
  ];
});

export const diagnostikaSlots: SlotDef[] = [
  ...heroSlots('diagnostika', HERO, DIAG_HERO),

  textSlot('diagnostika.services.title', 'Naše služby — titulek sekce', SERVICES, DIAG_SERVICES_TITLE),
  textSlot('diagnostika.services.link', 'Naše služby — odkaz na detail', SERVICES, DIAG_SERVICE_LINK),
  ...serviceSlots,

  textSlot('diagnostika.key.eyebrow', 'Klíčové sdělení — nadpis nad titulkem', KEY, DIAG_KEY.eyebrow),
  textSlot('diagnostika.key.title', 'Klíčové sdělení — titulek', KEY, DIAG_KEY.title),
  textSlot('diagnostika.key.text', 'Klíčové sdělení — text', KEY, DIAG_KEY.text, { multiline: true }),
  textSlot('diagnostika.custom.title', 'Balíčky na míru — titulek', KEY, DIAG_CUSTOM.title),
  textSlot('diagnostika.custom.text', 'Balíčky na míru — text', KEY, DIAG_CUSTOM.text, { multiline: true }),
  textSlot('diagnostika.custom.link', 'Balíčky na míru — odkaz na kontakt', KEY, DIAG_CUSTOM.link),
  ...listSlots('diagnostika.features', KEY, 'Co získáte', DIAG_FEATURES),

  textSlot('diagnostika.tech.title', 'Technologie — titulek sekce', TECH, DIAG_TECH.title),
  textSlot('diagnostika.tech.subtitle', 'Technologie — podtitulek', TECH, DIAG_TECH.subtitle),
  textSlot('diagnostika.tech.text', 'Technologie — dlouhý popis', TECH, DIAG_TECH.text, { multiline: true }),
  ...cardSlots('diagnostika.tech', TECH, 'Vlastnost', DIAG_TECH.cards),

  textSlot('diagnostika.viz.title', 'Od vizualizace ke změně — titulek sekce', VIZ, DIAG_VIZ_TITLE),
  ...vizSlots,
  photoSlot('diagnostika.viz.photo7', 'Od vizualizace ke změně — grafika výsledků', VIZ, DIAG_VIZ_EXTRA_PHOTO),

  textSlot('diagnostika.faq.duration.title', 'Délka a výsledky — titulek sekce', FAQ, DIAG_FAQ.duration.title),
  ...paraSlots('diagnostika.faq.duration', FAQ, 'Délka a výsledky', DIAG_FAQ.duration.paras),
  textSlot('diagnostika.faq.report.title', 'Výstupní zpráva — titulek sekce', FAQ, DIAG_FAQ.report.title),
  textSlot('diagnostika.faq.report.rawtitle', 'Výstupní zpráva — surová data: titulek', FAQ, DIAG_FAQ.report.rawTitle),
  ...paraSlots('diagnostika.faq.report.raw', FAQ, 'Výstupní zpráva — surová data', DIAG_FAQ.report.raw),
  textSlot('diagnostika.faq.report.listtitle', 'Výstupní zpráva — obsah: titulek', FAQ, DIAG_FAQ.report.listTitle),
  ...listSlots('diagnostika.faq.report', FAQ, 'Výstupní zpráva — obsah', DIAG_FAQ.report.items),
  ...paraSlots('diagnostika.faq.report.closing', FAQ, 'Výstupní zpráva — závěr', DIAG_FAQ.report.closing),
  textSlot('diagnostika.faq.repeat.title', 'Opakování diagnostiky — titulek sekce', FAQ, DIAG_FAQ.repeat.title),
  ...paraSlots('diagnostika.faq.repeat', FAQ, 'Opakování diagnostiky', DIAG_FAQ.repeat.paras),

  textSlot('diagnostika.price.title', 'Ceník — titulek sekce', PRICE, DIAG_PRICE.title),
  textSlot('diagnostika.price.text', 'Ceník — úvod', PRICE, DIAG_PRICE.text, { multiline: true }),
  textSlot('diagnostika.price.more', 'Ceník — titulek dalších služeb z ceníku', PRICE, DIAG_PRICE.more),
  ...cardSlotDefs(DIAG_CARD_PREFIX, PRICE, DIAG_CARDS),
  ...lineSlotDefs(DIAG_LINE_PREFIX, PRICE, DIAG_LINES),

  textSlot('diagnostika.info.title', 'Důležité pokyny — titulek sekce', END, DIAG_INFO.title),
  textSlot('diagnostika.info.docs', 'Důležité pokyny — odkaz na dokumenty', END, DIAG_INFO.docs),
  textSlot('diagnostika.info.prices', 'Důležité pokyny — odkaz na ceník', END, DIAG_INFO.prices),
  textSlot('diagnostika.booking.title', 'Rezervační systém — titulek sekce', END, DIAG_BOOKING.title),
  textSlot('diagnostika.booking.text', 'Rezervační systém — text', END, DIAG_BOOKING.text, { multiline: true }),
  textSlot('diagnostika.booking.button', 'Rezervační systém — tlačítko', END, DIAG_BOOKING.button),
];
