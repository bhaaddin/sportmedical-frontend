import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { heroSlots } from '../../web/pages/services/slotFactory';

/*
 * Ceník (/web/cenik). The list itself is the price list's (GET /api/public/price-list, every
 * category and row as the admin keeps them) — only the frame around it is editable here.
 * Defaults: the artboard V-Cenik. No amount is written here.
 */

const HERO = 'Ceník › Hero';
const LIST = 'Ceník › Ceník a poznámky';

export const cenikSlots: SlotDef[] = [
  ...heroSlots('cenik', HERO, {
    eyebrow: 'Ceník služeb',
    title: 'Všechny ceny na jednom místě',
    lead: 'Ceny jsou konečné, platí se na místě. U skupin se sleva dopočítá automaticky. Kluby mají individuální nabídku.',
    photoCaption: 'recepce kliniky',
  }),

  textSlot('cenik.nav.clubs', 'Odkazy na kategorie — poslední odkaz (skupiny a kluby)', LIST, 'Kluby'),
  textSlot('cenik.error.text', 'Ceník se nenačetl — hlášení', LIST, 'Ceník se teď nepodařilo načíst. Ceny proto nevidíte; zkuste to prosím znovu.'),
  textSlot('cenik.error.retry', 'Ceník se nenačetl — tlačítko', LIST, 'Zkusit znovu'),
  textSlot('cenik.book.cta', 'Pod ceníkem — tlačítko', LIST, 'Objednat termín'),
  textSlot(
    'cenik.note',
    'Poznámka pod ceníkem',
    LIST,
    'Základní měření InBody 770 je součástí zátěžových testů bez příplatku. Platba hotově nebo kartou na místě, klubům vystavíme fakturu.',
    { multiline: true },
  ),
];
