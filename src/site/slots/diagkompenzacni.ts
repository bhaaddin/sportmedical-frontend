import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /diagnostika/kompenzacni-plan. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Kompenzační plán › Úvod';

export const diagkompenzacniSlots: SlotDef[] = [
  textSlot('diagkompenzacni.hero.title', 'Úvod — titulek stránky', HERO, 'Kompenzační plán'),
];
