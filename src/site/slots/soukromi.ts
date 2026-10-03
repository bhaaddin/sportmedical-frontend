import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /ochrana-osobnich-udaju. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Ochrana osobních údajů › Úvod';

export const soukromiSlots: SlotDef[] = [
  textSlot('soukromi.hero.title', 'Úvod — titulek stránky', HERO, 'Ochrana osobních údajů'),
];
