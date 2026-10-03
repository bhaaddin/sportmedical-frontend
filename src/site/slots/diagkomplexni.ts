import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Slots of the page /diagnostika/komplexni. Placeholder until its page agent fills it from docs/etapa3/live-site. */

const HERO = 'Komplexní diagnostika › Úvod';

export const diagkomplexniSlots: SlotDef[] = [
  textSlot('diagkomplexni.hero.title', 'Úvod — titulek stránky', HERO, 'Komplexní diagnostika'),
];
