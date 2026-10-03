/* ══════════════════════════════════════════════════════════════
   "MÉDIA A TEXTY" — WHAT THE SCREEN LISTS

   Everything here is derived from the slot registry (src/site/siteSlots.ts):
   adding a slot there adds a card here. The registry names a slot's group as
   "Úvodní stránka › Hero": the part before "›" is the page (a row in the left
   list), the part after it is a heading inside that page.
   ══════════════════════════════════════════════════════════════ */

import { SLOTS_BY_PAGE } from '../../../site/siteSlots';
import { FAQ_PATH, PARTNERS_PATH, PUBLIC_PATHS } from './publicPaths';
import type { SlotDef } from '../../../site/slotTypes';
import type { AdminSlot } from '../../../api/siteContentAdmin';

/** The public page a registry page lives on: src/pages/settings/siteContent/publicPaths.ts (derived from src/web/sitePaths.ts). */
export { PUBLIC_PATHS } from './publicPaths';

export const PARTNERS_ID = 'partners';
export const FAQ_ID = 'faq';

export interface SlotSection {
  title: string;
  slots: SlotDef[];
}

export interface SlotPage {
  type: 'slots';
  id: string;
  label: string;
  /** Where the public site shows this page, when we know. */
  path?: string;
  slots: SlotDef[];
  sections: SlotSection[];
}

export interface ListPage {
  type: 'partners' | 'faq';
  id: string;
  label: string;
  path: string;
}

export type AdminPage = SlotPage | ListPage;

const SEPARATOR = ' › ';

const pageLabel = (group: string): string => group.split(SEPARATOR)[0];
const sectionTitle = (group: string): string => {
  const at = group.indexOf(SEPARATOR);
  return at < 0 ? group : group.slice(at + SEPARATOR.length);
};

/** Every page that has at least one slot (the shared footer last), then partners and the FAQ. */
export function buildPages(): AdminPage[] {
  const pages: SlotPage[] = [];
  for (const [id, slots] of Object.entries(SLOTS_BY_PAGE) as [string, readonly SlotDef[]][]) {
    if (slots.length === 0) continue;
    const sections: SlotSection[] = [];
    for (const slot of slots) {
      const title = sectionTitle(slot.group);
      const last = sections[sections.length - 1];
      if (last !== undefined && last.title === title) last.slots.push(slot);
      else sections.push({ title, slots: [slot] });
    }
    pages.push({ type: 'slots', id, label: pageLabel(slots[0].group), path: PUBLIC_PATHS[id], slots: [...slots], sections });
  }
  pages.sort((a, b) => Number(a.id === 'spolecne') - Number(b.id === 'spolecne'));
  return [
    ...pages,
    { type: 'partners', id: PARTNERS_ID, label: 'Partneři', path: PARTNERS_PATH },
    { type: 'faq', id: FAQ_ID, label: 'Časté otázky', path: FAQ_PATH },
  ];
}

/* ── Filled / total ── */

export const isMediaSlot = (def: SlotDef): boolean => def.kind === 'image' || def.kind === 'video';

/** A text slot is "filled" when somebody wrote their own text, a media slot when a file is uploaded. */
export function isFilled(def: SlotDef, value: AdminSlot | undefined): boolean {
  if (value === undefined) return false;
  if (isMediaSlot(def)) return value.mediaUrl !== undefined;
  return value.text !== undefined && value.text.trim() !== '';
}

export interface Counter {
  filled: number;
  total: number;
  mediaFilled: number;
  mediaTotal: number;
  textFilled: number;
  textTotal: number;
}

export function countSlots(slots: readonly SlotDef[], values: Record<string, AdminSlot>): Counter {
  const counter: Counter = { filled: 0, total: slots.length, mediaFilled: 0, mediaTotal: 0, textFilled: 0, textTotal: 0 };
  for (const def of slots) {
    const filled = isFilled(def, values[def.key]);
    if (filled) counter.filled += 1;
    if (isMediaSlot(def)) {
      counter.mediaTotal += 1;
      if (filled) counter.mediaFilled += 1;
    } else {
      counter.textTotal += 1;
      if (filled) counter.textFilled += 1;
    }
  }
  return counter;
}

/* ── Search ── */

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function matchesQuery(def: SlotDef, query: string): boolean {
  const needle = fold(query.trim());
  if (needle === '') return true;
  return [def.label, def.key, def.group, def.defaultText ?? '', def.caption ?? ''].some((part) => fold(part).includes(needle));
}

/** The text field is a multi-line editor when the registry says so or the sentence is long/has line breaks. */
export function isMultiline(def: SlotDef): boolean {
  return def.multiline === true || (def.defaultText ?? '').includes('\n') || (def.defaultText ?? '').length > 70;
}

/* ── Time ── */

const WHEN = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** "3. 10. 2026 14:05" — or '' when the value is not a date. */
export function formatWhen(iso: string | undefined): string {
  if (iso === undefined) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return WHEN.format(date).replace(/ /g, ' ');
}

/** The sentence under a slot: who changed it and when ('' when the server sent neither). */
export function changedLine(slot: AdminSlot | undefined): string {
  if (slot === undefined) return '';
  const when = formatWhen(slot.updatedAtUtc);
  const who = slot.updatedBy ?? '';
  if (who === '' && when === '') return '';
  return `Změnil${who !== '' ? ` ${who}` : ''}${when !== '' ? ` · ${when}` : ''}`;
}

/** The label of a "Doporučeno …" line, or the placeholder sentence of an empty media slot. */
export function placeholderSentence(def: SlotDef): string {
  const noun = def.kind === 'video' ? 'video' : 'fotka';
  return def.recommended !== undefined ? `Sem patří ${noun} — doporučeno ${def.recommended}` : `Sem patří ${noun}`;
}

/* ── Drafts: what has been typed and not yet saved ── */

export interface SlotDraft {
  text?: string;
  alt?: string;
}

/** The text a text slot shows now: the admin's own, else the registry's default. */
export function effectiveText(def: SlotDef, value: AdminSlot | undefined): string {
  return value?.text !== undefined && value.text.trim() !== '' ? value.text : def.defaultText ?? '';
}

/** What a save of this draft would send ({} when nothing differs from what is stored). */
export function draftChanges(def: SlotDef, value: AdminSlot | undefined, draft: SlotDraft | undefined): { text?: string; alt?: string } {
  const changes: { text?: string; alt?: string } = {};
  if (draft === undefined) return changes;
  if (!isMediaSlot(def) && draft.text !== undefined && draft.text !== effectiveText(def, value)) changes.text = draft.text;
  if (isMediaSlot(def) && draft.alt !== undefined && draft.alt !== (value?.alt ?? '')) changes.alt = draft.alt;
  return changes;
}

export const isDirty = (def: SlotDef, value: AdminSlot | undefined, draft: SlotDraft | undefined): boolean =>
  Object.keys(draftChanges(def, value, draft)).length > 0;

export const TEXT_LIMIT = 4000;
export const ALT_LIMIT = 300;

/** The sentence under a field that cannot be saved; undefined = fine. */
export function draftProblem(def: SlotDef, changes: { text?: string; alt?: string }): string | undefined {
  if (changes.text !== undefined) {
    if (changes.text.trim() === '') return 'Text nesmí být prázdný. Chcete-li výchozí text, použijte „Vrátit výchozí“.';
    if (changes.text.length > TEXT_LIMIT) return `Text je příliš dlouhý (nejvýš ${TEXT_LIMIT} znaků).`;
  }
  if (changes.alt !== undefined && changes.alt.length > ALT_LIMIT) return `Popis je příliš dlouhý (nejvýš ${ALT_LIMIT} znaků).`;
  void def;
  return undefined;
}
