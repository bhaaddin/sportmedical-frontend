/* ══════════════════════════════════════════════════════════════
   SLOT DECLARATIONS SHARED BY THE SERVICE PAGES

   Služby, Prohlídky, Diagnostika, InBody, Ceník, Vybavení and the four detail pages all start
   with the same hero and repeat the same card grids, paragraphs, lists and photo galleries.
   These helpers produce the registry entries (key, label, group, default) for them, so the
   registries in src/site/slots/ stay short and the keys follow one pattern:

     <page>.hero.{eyebrow,title,lead,photo}
     <prefix>.<n>.{title,text,more}   (cards)
     <prefix>.p<n>                    (paragraphs)
     <prefix>.li<n>                   (bullets)
     <prefix>.photo<n>                (galleries)

   The page files render the same arrays (count = array length), so a slot cannot be registered
   without being drawn, or drawn without being registered.

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
  /** A third line under the text (the expandable part of a live card): `<prefix>.<n>.more`. */
  more?: string;
}

/** `${prefix}.1.title`, `${prefix}.1.text` (and `.more`), … one set per card. */
export function cardSlots(prefix: string, group: string, noun: string, cards: readonly CardDefaults[]): SlotDef[] {
  return cards.flatMap((card, index) => [
    textSlot(`${prefix}.${index + 1}.title`, `${noun} ${index + 1} — titulek`, group, card.title),
    textSlot(`${prefix}.${index + 1}.text`, `${noun} ${index + 1} — popis`, group, card.text, { multiline: true }),
    ...(card.more !== undefined
      ? [textSlot(`${prefix}.${index + 1}.more`, `${noun} ${index + 1} — doplnění`, group, card.more, { multiline: true })]
      : []),
  ]);
}

/** `${prefix}.photo1`, … one photo slot per caption. */
export function gallerySlots(prefix: string, group: string, noun: string, captions: readonly string[]): SlotDef[] {
  return captions.map((caption, index) =>
    mediaSlot(`${prefix}.photo${index + 1}`, `${noun} — fotka ${index + 1} z ${captions.length}`, group, caption, '1200 × 900 px', '4 / 3'),
  );
}

/** `${prefix}.p1`, `.p2`, … one multi-line text per paragraph (drawn by `<Paras prefix count>`). */
export function paraSlots(prefix: string, group: string, noun: string, paragraphs: readonly string[]): SlotDef[] {
  return paragraphs.map((text, index) => textSlot(`${prefix}.p${index + 1}`, `${noun} — odstavec ${index + 1}`, group, text, { multiline: true }));
}

/** `${prefix}.li1`, … one text per bullet (drawn by `<Bullets prefix count>`). */
export function listSlots(prefix: string, group: string, noun: string, items: readonly string[]): SlotDef[] {
  return items.map((text, index) => textSlot(`${prefix}.li${index + 1}`, `${noun} — ${index + 1}. položka`, group, text, { multiline: true }));
}

/** One photo placeholder (`${key}`), 4:3, the usual size. */
export function photoSlot(key: string, label: string, group: string, caption: string, aspect = '4 / 3', recommended = '1200 × 900 px'): SlotDef {
  return mediaSlot(key, label, group, caption, recommended, aspect);
}
