import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /storno-a-reklamace. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Storno a reklamace › Úvod';

export const stornoSlots: SlotDef[] = [
  textSlot('storno.hero.title', 'Úvod — titulek stránky', HERO, 'Storno a reklamace'),
];
