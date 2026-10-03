import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { heroSlots, listSlots } from '../../web/pages/services/slotFactory';

/*
 * Ceník (/cenik). The list itself is the price list's (GET /api/public/price-list, every category and
 * row as the admin keeps them, the list price crossed out when the list has one) — only the frame
 * around it is editable here. Defaults: the wording of the live site (the intro of the price list of
 * the examinations page, the payment rules of the refund policy, the document rules of the examinations
 * page, the validity answer of the FAQ). No amount is written here.
 */

const HERO = 'Ceník › Hero';
const LIST = 'Ceník › Ceník';
const NOTES = 'Ceník › Poznámky pod ceníkem';

export const CENIK_DOCS = [
  'Výpis ze zdravotní dokumentace',
  'Zdravotní dotazník',
  'Souhlas pacienta (GDPR)',
  'Souhlas zákonného zástupce',
] as const;

export const cenikSlots: SlotDef[] = [
  ...heroSlots('cenik', HERO, {
    eyebrow: 'Služby',
    title: 'Ceník služeb',
    lead: 'Nabízíme široké spektrum sportovně lékařských vyšetření, která si můžete zvolit podle svých individuálních potřeb, míry sportovní zátěže i požadovaného rozsahu vyšetření.',
    photoCaption: 'recepce kliniky',
  }),

  textSlot('cenik.nav.clubs', 'Odkazy na kategorie — poslední odkaz (skupiny a kluby)', LIST, 'Kluby'),
  textSlot('cenik.error.text', 'Ceník se nenačetl — hlášení', LIST, 'Ceník se teď nepodařilo načíst. Ceny proto nevidíte; zkuste to prosím znovu.'),
  textSlot('cenik.error.retry', 'Ceník se nenačetl — tlačítko', LIST, 'Zkusit znovu'),
  textSlot('cenik.book.cta', 'Pod ceníkem — tlačítko', LIST, 'Objednat termín'),

  textSlot('cenik.notes.title', 'Poznámky — titulek sekce', NOTES, 'Další informace'),
  textSlot('cenik.note.inbody', 'Poznámka — InBody v ceně zátěžových testů', NOTES, 'Základní InBody měření je zahrnuto v každém zátěžovém testu zdarma.', { multiline: true }),
  textSlot('cenik.note.pay.title', 'Poznámka — platba: titulek', NOTES, 'Objednání a platba'),
  textSlot(
    'cenik.note.pay',
    'Poznámka — platba',
    NOTES,
    'Služby mohou být hrazeny předem online (rezervace s platbou nebo zálohou), nebo na místě dle zvoleného typu služby. U vybraných služeb může být požadována platba předem nebo záloha jako potvrzení rezervace termínu.',
    { multiline: true },
  ),
  textSlot('cenik.note.docs.title', 'Poznámka — dokumenty: titulek', NOTES, 'Potřebné dokumenty ke sportovní lékařské prohlídce'),
  ...listSlots('cenik.note.docs', NOTES, 'Dokumenty', CENIK_DOCS),
  textSlot('cenik.note.docs.text', 'Poznámka — dokumenty: text', NOTES, 'Bez výpisu ze zdravotní dokumentace nelze vystavit posudek o zdravotní způsobilosti ke sportu.', { multiline: true }),
  textSlot('cenik.note.docs.link', 'Poznámka — dokumenty: odkaz', NOTES, 'Dokumenty ke stažení'),
  textSlot('cenik.note.validity.title', 'Poznámka — platnost posudku: titulek', NOTES, 'Jak dlouho jsou zdravotní prohlídky platné?'),
  textSlot(
    'cenik.note.validity',
    'Poznámka — platnost posudku',
    NOTES,
    'Lékařský posudek o zdravotní způsobilosti ke sportu je platný nejdéle 12 měsíců od data vystavení. Lékař však může určit kratší dobu, pokud to vyžaduje zdravotní stav.',
    { multiline: true },
  ),
  textSlot('cenik.note.contact.link', 'Poznámka — odkaz na kontakt a ordinační dobu', NOTES, 'Adresa, kontakt a ordinační doba'),
];
