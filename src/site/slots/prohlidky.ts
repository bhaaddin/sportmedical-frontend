import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';
import { heroSlots, listSlots, paraSlots } from '../../web/pages/services/slotFactory';
import { cardSlotDefs, lineSlotDefs } from '../../web/pages/services/content/cards';
import {
  CMP, CMP_ROWS, DOCS, DOCS_INTRO, DURATION, EQUIPMENT_TEASER, EXAMS, EXAMS_INTRO, EXAM_CARDS, EXAM_CARD_PREFIX, EXAM_LINES,
  EXAM_LINE_PREFIX, INSTRUCTIONS, MOBILE, PACKAGES, PREP, PRICE_SECTION, PROHLIDKY_HERO, VALIDITY, WHEN_NOT,
} from '../../web/pages/services/content/prohlidky';

/*
 * Sportovní lékařské prohlídky (/prohlidky). Defaults: the wording of the live page
 * sportmedical-diagnostics.cz/pages/sportovni-lekarske-prohlidky (and the preparation / duration /
 * validity answers of its FAQ), as published. Prices are NOT here: they come from the price list,
 * matched by name; so are the group discounts (the discount tiers).
 * The page draws the very same arrays (src/web/pages/services/content/prohlidky.ts).
 */

const HERO = 'Prohlídky › Hero';
const EXAMS_G = 'Prohlídky › Tři prohlídky';
const CMP_G = 'Prohlídky › Porovnání prohlídek (tabulka)';
const DOCS_G = 'Prohlídky › Potřebné dokumenty';
const PREP_G = 'Prohlídky › Příprava, délka a platnost';
const PKG_G = 'Prohlídky › Zvýhodněné balíčky';
const MOBILE_G = 'Prohlídky › Mobilní testy pro kluby';
const PRICE_G = 'Prohlídky › Ceník — karty vyšetření';

const examSlots = EXAMS.flatMap((exam, index): SlotDef[] => {
  const n = index + 1;
  return [
    textSlot(`prohlidky.exam.${n}.title`, `Prohlídka ${n} — název`, EXAMS_G, exam.title),
    textSlot(`prohlidky.exam.${n}.text`, `Prohlídka ${n} — krátký popis`, EXAMS_G, exam.text, { multiline: true }),
    ...listSlots(`prohlidky.exam.${n}`, EXAMS_G, `Prohlídka ${n}`, exam.bullets),
    textSlot(`prohlidky.exam.${n}.more`, `Prohlídka ${n} — úplný popis`, EXAMS_G, exam.more, { multiline: true }),
    mediaSlot(`prohlidky.exam.${n}.photo`, `Prohlídka ${n} — foto`, EXAMS_G, exam.photoCaption, '1200 × 800 px', '3 / 2'),
  ];
});

const cmpSlots = [
  textSlot('prohlidky.cmp.title', 'Porovnání — titulek sekce', CMP_G, CMP.title),
  textSlot('prohlidky.cmp.lead', 'Porovnání — úvod', CMP_G, CMP.lead, { multiline: true }),
  textSlot('prohlidky.cmp.caption', 'Porovnání — popis tabulky pro čtečky obrazovky', CMP_G, CMP.caption),
  textSlot('prohlidky.cmp.yes', 'Porovnání — „ano“ v buňce', CMP_G, CMP.yes),
  textSlot('prohlidky.cmp.no', 'Porovnání — „ne“ v buňce', CMP_G, CMP.no),
  textSlot('prohlidky.cmp.price', 'Porovnání — název řádku s cenou (cena je z ceníku)', CMP_G, CMP.priceLabel),
  ...CMP.heads.map((head, index) => textSlot(`prohlidky.cmp.h${index}`, `Porovnání — záhlaví sloupce ${index}`, CMP_G, head, { multiline: true })),
  ...CMP_ROWS.flatMap((row, index): SlotDef[] => [
    textSlot(`prohlidky.cmp.r${index + 1}.label`, `Porovnání — řádek ${index + 1}: název`, CMP_G, row.label),
    ...row.cells.flatMap((cell, cellIndex): SlotDef[] =>
      typeof cell === 'string'
        ? [textSlot(`prohlidky.cmp.r${index + 1}.c${cellIndex + 1}`, `Porovnání — řádek ${index + 1}, sloupec ${cellIndex + 1}`, CMP_G, cell, { multiline: true })]
        : [],
    ),
  ]),
];

const docSlots = DOCS.flatMap((doc, index): SlotDef[] => [
  textSlot(`prohlidky.docs.${index + 1}.title`, `Dokument ${index + 1} — název`, DOCS_G, doc.title),
  ...paraSlots(`prohlidky.docs.${index + 1}`, DOCS_G, `Dokument ${index + 1}`, doc.paras),
]);

export const prohlidkySlots: SlotDef[] = [
  ...heroSlots('prohlidky', HERO, PROHLIDKY_HERO),

  textSlot('prohlidky.exams.title', 'Tři prohlídky — titulek sekce', EXAMS_G, EXAMS_INTRO.title),
  textSlot('prohlidky.exams.lead', 'Tři prohlídky — úvod', EXAMS_G, EXAMS_INTRO.lead, { multiline: true }),
  ...examSlots,

  ...cmpSlots,

  textSlot('prohlidky.docs.title', 'Dokumenty — titulek sekce', DOCS_G, DOCS_INTRO.title),
  ...docSlots,
  textSlot('prohlidky.instr.title', 'Důležité informace před vyšetřením — titulek', DOCS_G, INSTRUCTIONS.title),
  textSlot('prohlidky.instr.subtitle', 'Důležité informace před vyšetřením — podtitulek', DOCS_G, INSTRUCTIONS.subtitle),
  textSlot('prohlidky.instr.text', 'Důležité informace před vyšetřením — text', DOCS_G, INSTRUCTIONS.text, { multiline: true }),

  textSlot('prohlidky.prep.title', 'Příprava — titulek sekce', PREP_G, PREP.title),
  textSlot('prohlidky.prep.before.title', 'Příprava — „co je důležité vědět“: titulek', PREP_G, PREP.before.title),
  ...paraSlots('prohlidky.prep.before', PREP_G, 'Příprava — co je důležité vědět', PREP.before.paras),
  textSlot('prohlidky.prep.bring.title', 'Příprava — „co mít s sebou“: titulek', PREP_G, PREP.bring.title),
  ...listSlots('prohlidky.prep.bring', PREP_G, 'Příprava — co mít s sebou', PREP.bring.items),
  textSlot('prohlidky.prep.closing.title', 'Příprava — závěrečné doporučení: titulek', PREP_G, PREP.closing.title),
  ...paraSlots('prohlidky.prep.closing', PREP_G, 'Příprava — závěrečné doporučení', PREP.closing.paras),

  textSlot('prohlidky.duration.title', 'Délka vyšetření — titulek sekce', PREP_G, DURATION.title),
  textSlot('prohlidky.duration.ergo.title', 'Délka — ergometrie: titulek', PREP_G, DURATION.ergo.title),
  ...paraSlots('prohlidky.duration.ergo', PREP_G, 'Délka — ergometrie', DURATION.ergo.paras),
  textSlot('prohlidky.duration.spiro.title', 'Délka — spiroergometrie: titulek', PREP_G, DURATION.spiro.title),
  ...paraSlots('prohlidky.duration.spiro', PREP_G, 'Délka — spiroergometrie', DURATION.spiro.paras),

  textSlot('prohlidky.whennot.title', 'Kdy test nelze provést — titulek sekce', PREP_G, WHEN_NOT.title),
  ...listSlots('prohlidky.whennot', PREP_G, 'Kdy test nelze provést', WHEN_NOT.items),
  ...paraSlots('prohlidky.whennot', PREP_G, 'Kdy test nelze provést', WHEN_NOT.paras),
  textSlot('prohlidky.whennot.legal.title', 'Právní rámec — titulek', PREP_G, WHEN_NOT.legalTitle),
  ...paraSlots('prohlidky.whennot.legal', PREP_G, 'Právní rámec', WHEN_NOT.legal),

  textSlot('prohlidky.validity.title', 'Platnost posudku — titulek sekce', PREP_G, VALIDITY.title),
  ...paraSlots('prohlidky.validity', PREP_G, 'Platnost posudku', VALIDITY.paras),

  textSlot('prohlidky.packages.title', 'Balíčky — titulek sekce', PKG_G, PACKAGES.title),
  ...paraSlots('prohlidky.packages', PKG_G, 'Balíčky', PACKAGES.paras),

  textSlot('prohlidky.mobile.eyebrow', 'Mobilní testy — nadpis nad titulkem', MOBILE_G, MOBILE.eyebrow),
  textSlot('prohlidky.mobile.title', 'Mobilní testy — titulek sekce', MOBILE_G, MOBILE.title),
  ...paraSlots('prohlidky.mobile', MOBILE_G, 'Mobilní testy', MOBILE.paras),
  textSlot('prohlidky.mobile.link', 'Mobilní testy — odkaz na stránku pro kluby', MOBILE_G, MOBILE.link),
  mediaSlot('prohlidky.mobile.photo', 'Mobilní testy — foto', MOBILE_G, MOBILE.photoCaption, '1200 × 800 px', '3 / 2'),

  textSlot('prohlidky.equipment.title', 'Vybavení — titulek sekce', MOBILE_G, EQUIPMENT_TEASER.title),
  textSlot('prohlidky.equipment.link', 'Vybavení — odkaz na stránku Vybavení', MOBILE_G, EQUIPMENT_TEASER.link),

  textSlot('prohlidky.price.title', 'Ceník — titulek sekce', PRICE_G, PRICE_SECTION.title),
  ...paraSlots('prohlidky.price', PRICE_G, 'Ceník', PRICE_SECTION.paras),
  textSlot('prohlidky.price.more', 'Ceník — titulek dalších variant z ceníku', PRICE_G, PRICE_SECTION.more),
  ...cardSlotDefs(EXAM_CARD_PREFIX, PRICE_G, EXAM_CARDS),
  ...lineSlotDefs(EXAM_LINE_PREFIX, PRICE_G, EXAM_LINES),
];
