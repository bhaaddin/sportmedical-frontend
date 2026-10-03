import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /diagnostika/vo2max. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'VO₂max analýza › Úvod';

export const diagvo2maxSlots: SlotDef[] = [
  textSlot('diagvo2max.hero.title', 'Úvod — titulek stránky', HERO, 'VO₂max analýza'),
];
