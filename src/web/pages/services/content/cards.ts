/* ══════════════════════════════════════════════════════════════
   THE DATA OF THE PRICE CARDS (types and the registry entries made from them)

   No React in here: the slot registry imports this file. `<PriceCard>` draws a `CardDef`; the
   registry gets one text slot per title / intro / note and one pair per line (name + expandable
   text) from the very same objects, so what is registered is what is drawn.
   ══════════════════════════════════════════════════════════════ */

import { textSlot } from '../../../../site/slotTypes';
import type { SlotDef } from '../../../../site/slotTypes';
import type { PriceMatch } from '../pricing';

/** The halves of the packages, folded (matched against the part of a name on one side of a "+"). */
export const PART = {
  komplexniProhlidka: /^komplexni (sportovni )?prohlidka/,
  zakladniDiagnostika: /^zakladni diagnostika/,
  komplexniDiagnostika: /^(komplexni|kompletni) diagnostika/,
  spiro: /^spiroergometri/,
  vo2max: /^vo2max/,
} as const;

export interface LineDef {
  name: string;
  /** The expandable part; a line without one is a plain row. */
  text?: string;
}

export type LineLibrary = Readonly<Record<string, LineDef>>;

export interface CardDef {
  id: string;
  title: string;
  /** A short paragraph under the title. */
  intro?: string;
  /** A note under the lines ("NEZAHRNUJE …"). */
  note?: string;
  badge?: boolean;
  match: PriceMatch;
  inc: readonly string[];
  exc: readonly string[];
  /** 'phone' = ordered by phone or message on the live site: the card adds the clinic's phone. */
  cta?: 'book' | 'phone';
}

/** `<prefix>.<id>.title|intro|note` of every card. */
export function cardSlotDefs(prefix: string, group: string, cards: readonly CardDef[]): SlotDef[] {
  return cards.flatMap((card) => [
    textSlot(`${prefix}.${card.id}.title`, `Karta „${card.title}“ — název`, group, card.title),
    ...(card.intro !== undefined ? [textSlot(`${prefix}.${card.id}.intro`, `Karta „${card.title}“ — úvod`, group, card.intro, { multiline: true })] : []),
    ...(card.note !== undefined ? [textSlot(`${prefix}.${card.id}.note`, `Karta „${card.title}“ — upozornění`, group, card.note, { multiline: true })] : []),
  ]);
}

/** `<linePrefix>.<id>.name|text` of the lines the cards share. */
export function lineSlotDefs(linePrefix: string, group: string, lines: LineLibrary): SlotDef[] {
  return Object.entries(lines).flatMap(([id, line]) => [
    textSlot(`${linePrefix}.${id}.name`, `Řádek „${line.name}“ — název`, group, line.name),
    ...(line.text !== undefined ? [textSlot(`${linePrefix}.${id}.text`, `Řádek „${line.name}“ — bližší informace`, group, line.text, { multiline: true })] : []),
  ]);
}
