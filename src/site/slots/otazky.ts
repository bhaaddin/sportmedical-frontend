import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /faq. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Často kladené otázky › Úvod';

export const otazkySlots: SlotDef[] = [
  textSlot('otazky.hero.title', 'Úvod — titulek stránky', HERO, 'Často kladené otázky'),
];
