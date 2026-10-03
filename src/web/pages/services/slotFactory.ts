/* ══════════════════════════════════════════════════════════════
   SLOT DECLARATIONS SHARED BY THE FIVE SERVICE PAGES

   Služby, Prohlídky, Diagnostika, InBody and Ceník all start with the same hero and
   repeat the same card grids and photo galleries. These helpers produce the registry
   entries (key, label, group, default) for them, so the registries in src/site/slots/
   stay short and the keys follow one pattern:

     <page>.hero.{eyebrow,title,lead,photo}
     <prefix>.<n>.{title,text}        (cards)
     <prefix>.photo<n>                (galleries)

   Only imports the slot types, so the registry can import this file without a cycle.
   ══════════════════════════════════════════════════════════════ */

import { mediaSlot, textSlot } from '../../../site/slotTypes';
import type { SlotDef } from '../../../site/slotTypes';

export interface HeroDefaults {
  eyebrow: string;
  title: string;
  lead: string;
  photoCaption: string;
}

export function heroSlots(page: string, group: string, d: HeroDefaults): SlotDef[] {
  return [
    textSlot(`${page}.hero.eyebrow`, 'Hero — nadpis nad titulkem', group, d.eyebrow),
    textSlot(`${page}.hero.title`, 'Hero — hlavní titulek (H1)', group, d.title),
    textSlot(`${page}.hero.lead`, 'Hero — úvodní odstavec', group, d.lead, { multiline: true }),
    mediaSlot(`${page}.hero.photo`, 'Hero — foto', group, d.photoCaption, '1200 × 900 px', '4 / 3'),
  ];
}

export interface CardDefaults {
  title: string;
  text: string;
}

/** `${prefix}.1.title`, `${prefix}.1.text`, … one pair per card. */
export function cardSlots(prefix: string, group: string, noun: string, cards: CardDefaults[]): SlotDef[] {
  return cards.flatMap((card, index) => [
    textSlot(`${prefix}.${index + 1}.title`, `${noun} ${index + 1} — titulek`, group, card.title),
    textSlot(`${prefix}.${index + 1}.text`, `${noun} ${index + 1} — popis`, group, card.text, { multiline: true }),
  ]);
}

/** `${prefix}.photo1`, … one photo slot per caption. */
export function gallerySlots(prefix: string, group: string, noun: string, captions: string[]): SlotDef[] {
  return captions.map((caption, index) =>
    mediaSlot(`${prefix}.photo${index + 1}`, `${noun} — fotka ${index + 1} z ${captions.length}`, group, caption, '1200 × 900 px', '4 / 3'),
  );
}
