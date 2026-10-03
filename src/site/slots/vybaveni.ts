import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /vybaveni. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Vybavení › Úvod';

export const vybaveniSlots: SlotDef[] = [
  textSlot('vybaveni.hero.title', 'Úvod — titulek stránky', HERO, 'Vybavení'),
];
