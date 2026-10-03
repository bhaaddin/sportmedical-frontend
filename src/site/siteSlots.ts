/* ══════════════════════════════════════════════════════════════
   THE REGISTRY OF EVERY KNOWN SLOT

   Assembled from the per-page files in src/site/slots/. The admin's
   "Média a texty" screen lists exactly this; the public pages read their
   defaults and captions from it. See slotTypes.ts for how to add one.
   ══════════════════════════════════════════════════════════════ */

import type { SlotDef } from './slotTypes';
import { landingSlots } from './slots/landing';
import { sluzbySlots } from './slots/sluzby';
import { prohlidkySlots } from './slots/prohlidky';
import { diagnostikaSlots } from './slots/diagnostika';
import { inbodySlots } from './slots/inbody';
import { cenikSlots } from './slots/cenik';
import { dokumentySlots } from './slots/dokumenty';
import { kontaktSlots } from './slots/kontakt';
import { onasSlots } from './slots/onas';
import { klubySlots } from './slots/kluby';
import { spolecneSlots } from './slots/spolecne';

export type { SlotDef, SlotKind } from './slotTypes';
export { mediaSlot, textSlot } from './slotTypes';

/** Slots per page, in the order the admin lists them. */
export const SLOTS_BY_PAGE = {
  spolecne: spolecneSlots,
  landing: landingSlots,
  sluzby: sluzbySlots,
  prohlidky: prohlidkySlots,
  diagnostika: diagnostikaSlots,
  inbody: inbodySlots,
  cenik: cenikSlots,
  dokumenty: dokumentySlots,
  kontakt: kontaktSlots,
  onas: onasSlots,
  kluby: klubySlots,
} as const;

export const SLOT_REGISTRY: SlotDef[] = Object.values(SLOTS_BY_PAGE).flat();

const BY_KEY = new Map<string, SlotDef>();
for (const slot of SLOT_REGISTRY) {
  if (BY_KEY.has(slot.key)) {
    // A duplicate key would let two pages overwrite each other's content: refuse loudly at load.
    throw new Error(`Duplicate site slot key: ${slot.key}`);
  }
  BY_KEY.set(slot.key, slot);
}

export const SLOT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

export function slotDef(key: string): SlotDef | undefined {
  return BY_KEY.get(key);
}

/** The default sentence of a text slot, '' when the key is unknown. */
export function slotDefaultText(key: string): string {
  return BY_KEY.get(key)?.defaultText ?? '';
}

/** The groups in registry order, each with its slots — the shape the admin list needs. */
export function slotGroups(): { group: string; slots: SlotDef[] }[] {
  const groups = new Map<string, SlotDef[]>();
  for (const slot of SLOT_REGISTRY) {
    const list = groups.get(slot.group);
    if (list === undefined) groups.set(slot.group, [slot]);
    else list.push(slot);
  }
  return [...groups.entries()].map(([group, slots]) => ({ group, slots }));
}
