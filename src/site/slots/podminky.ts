import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /obchodni-podminky. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Obchodní podmínky › Úvod';

export const podminkySlots: SlotDef[] = [
  textSlot('podminky.hero.title', 'Úvod — titulek stránky', HERO, 'Obchodní podmínky'),
];
