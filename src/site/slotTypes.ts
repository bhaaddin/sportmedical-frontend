/* ══════════════════════════════════════════════════════════════
   SLOT REGISTRY — TYPES

   A "slot" is one editable thing on the public site: a sentence, a photo,
   a video. The registry (src/site/siteSlots.ts) lists every slot the code
   knows about; the admin screen "Média a texty" is built from that list, and
   whatever the admin uploads or types is stored under the slot's key by the
   backend (GET /api/public/site-content, contract C5).

   To add a slot: add one `SlotDef` to the page's file in src/site/slots/ and
   use `<SlotText slotKey="…" />` or `<MediaSlot slotKey="…" />` in the page.
   Nothing else — the admin lists it automatically and the default shows until
   somebody overrides it.
   ══════════════════════════════════════════════════════════════ */

export type SlotKind = 'text' | 'image' | 'video';

export interface SlotDef {
  /** `^[a-z0-9][a-z0-9._-]{0,79}$` — the backend stores whatever key it is given. */
  key: string;
  /** What the admin sees in the list: "Hero — fotka 1 z 3". */
  label: string;
  /** The admin's group header: the page, then the section ("Úvodní stránka › Hero"). */
  group: string;
  /** What the code expects here. A media slot may be filled with an image OR a video. */
  kind: SlotKind;
  /** Recommended pixel size of a media file, "1600 × 1200 px". */
  recommended?: string;
  /** Text slots: the sentence shown until somebody writes another. Lines are separated by "\n". */
  defaultText?: string;
  /** Media slots: what the grey placeholder says ("spiroergometrie na ergometru" → "[FOTO: spiroergometrie na ergometru]"). */
  caption?: string;
  /** Media slots: the aspect ratio the layout reserves, "4 / 3" — nothing jumps when the file arrives. */
  aspect?: string;
  /** Text slots: true when the text is longer than a line (the admin shows a multi-line field). */
  multiline?: boolean;
}

/** Shorthand used by the per-page files, so every entry stays one readable block. */
export function textSlot(
  key: string,
  label: string,
  group: string,
  defaultText: string,
  extra: Partial<Pick<SlotDef, 'multiline'>> = {},
): SlotDef {
  return { key, label, group, kind: 'text', defaultText, ...extra };
}

export function mediaSlot(
  key: string,
  label: string,
  group: string,
  caption: string,
  recommended: string,
  aspect: string,
  kind: 'image' | 'video' = 'image',
): SlotDef {
  return { key, label, group, kind, caption, recommended, aspect };
}
