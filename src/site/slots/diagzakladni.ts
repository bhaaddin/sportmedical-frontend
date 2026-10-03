import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /diagnostika/zakladni. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Základní diagnostika › Úvod';

export const diagzakladniSlots: SlotDef[] = [
  textSlot('diagzakladni.hero.title', 'Úvod — titulek stránky', HERO, 'Základní diagnostika'),
];
