import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /partneri. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Partnerské kluby › Úvod';

export const partneriSlots: SlotDef[] = [
  textSlot('partneri.hero.title', 'Úvod — titulek stránky', HERO, 'Partnerské kluby'),
];
