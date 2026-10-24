/*
 * The command palette's brain: what can be asked for, how a typed word ranks it, and what is shown before anything is
 * typed. Pure functions - no React, no network - so the ranking is pinned by tests and the palette component only draws.
 *
 * A "command" is one row of the palette: an action ("Nová objednávka"), a page ("Dnešní přehled"), a settings screen,
 * or one of the clinic's entities (a patient, a club, an invoice ...). Every command knows where it goes (`to` + router
 * `state`, ids only) and, for an entity, carries its `EntityRef` so the row can wear the same chip as everywhere else.
 *
 * Permissions hide: a person who cannot open Fakturace is never offered "Fakturace" or an invoice; the server refuses
 * regardless (this is a courtesy, not protection).
 *
 * Privacy: a query that looks like a birth number or a long run of digits is never sent to a search endpoint
 * (`serverSearchAllowed`) - those would travel in a URL - and no row ever shows an identifier.
 */
import { SECTION_CHILDREN } from '../../../components/shell/shellModel';
import type { Permission } from '../../../auth/usePermission';
import { ENTITY_PLURAL, entityTarget, looksLikeIdentifier, mayOpen, refKey, type EntityKind, type EntityRef } from '../entities';
import type { RecentEntry, PinnedEntry } from '../memory';

/** Placeholder in a command's `state` for "the moment it is run" (the calendar reads `newAppointment` as a timestamp). */
export const NOW = '@now';

/** The router state a command is run with: ids and flags as written, `NOW` replaced by the clock. */
export function resolveState(state: Record<string, unknown> | undefined, now: number = Date.now()): Record<string, unknown> | undefined {
  if (state === undefined) return undefined;
  return Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v === NOW ? now : v]));
}

export type CommandGroup = 'action' | 'page' | 'settings' | EntityKind;

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  /** The grey line under the label: where it is, who it is for. */
  hint?: string;
  to: string;
  /** Router state, ids and flags only. */
  state?: Record<string, unknown>;
  /** Extra words that find it ("rezervace" finds "Nová objednávka"). */
  keywords?: readonly string[];
  requires?: Permission;
  entity?: EntityRef;
  /** Added to the score (an action the desk uses all day sits above a page of the same name). */
  boost?: number;
}

/** "Čeština" folded for matching: lower case, no diacritics, one space between words. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of a query, folded. */
export const wordsOf = (query: string): string[] => fold(query).split(' ').filter((w) => w !== '');

/** Shortest query that is sent to a server search (a single letter would list the register). */
export const MIN_SERVER_QUERY = 2;

/** May this text be sent to a search endpoint? Not when it looks like a birth number or an insurance number. */
export function serverSearchAllowed(query: string): boolean {
  const q = query.trim();
  return q.length >= MIN_SERVER_QUERY && !looksLikeIdentifier(q);
}

/*
 * The score of one command for one query: 0 = not an answer.
 *   label equals query                100
 *   label starts with query           80
 *   a word of the label starts with it 65   (and every query word must be found)
 *   label contains it                 50
 *   a keyword says it                 35
 *   only the hint says it             20
 * Multi-word queries need EVERY word to be found somewhere; the score is that of the weakest word, so "nova obj" and
 * "obj nova" both find "Nová objednávka". The boost and a small length tie-break (shorter label first) come last.
 */
export function scoreCommand(words: readonly string[], command: Command): number {
  if (words.length === 0) return 0;
  const label = fold(command.label);
  const hint = fold(command.hint ?? '');
  const keywords = fold((command.keywords ?? []).join(' '));
  const labelWords = label.split(' ');
  const whole = words.join(' ');
  let weakest = 100;
  for (const word of words) {
    let s = 0;
    if (label === word) s = 100;
    else if (label.startsWith(word)) s = 80;
    else if (labelWords.some((w) => w.startsWith(word))) s = 65;
    else if (label.includes(word)) s = 50;
    else if (keywords.includes(word)) s = 35;
    else if (hint.includes(word)) s = 20;
    if (s === 0) return 0;
    weakest = Math.min(weakest, s);
  }
  if (words.length > 1 && label === whole) weakest = 100;
  else if (words.length > 1 && label.startsWith(whole)) weakest = Math.max(weakest, 80);
  return weakest + (command.boost ?? 0) - Math.min(10, label.length / 12);
}

export interface RankContext {
  recents?: readonly RecentEntry[];
  pinned?: readonly PinnedEntry[];
}

/**
 * The commands a query answers, best first. A pinned entity gets +12 and a recent one +8 (what you opened lately is
 * more likely what you mean); ties keep the order they came in (stable), so a group the caller listed first stays first.
 */
export function rankCommands(query: string, commands: readonly Command[], context: RankContext = {}): Command[] {
  const words = wordsOf(query);
  if (words.length === 0) return [];
  const pinned = new Set((context.pinned ?? []).map(refKey));
  const recent = new Set((context.recents ?? []).map(refKey));
  const scored: { command: Command; score: number; order: number }[] = [];
  commands.forEach((command, order) => {
    const base = scoreCommand(words, command);
    if (base <= 0) return;
    const key = command.entity === undefined ? null : refKey(command.entity);
    const bonus = key === null ? 0 : pinned.has(key) ? 12 : recent.has(key) ? 8 : 0;
    scored.push({ command, score: base + bonus, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.command);
}

/* ───────────────────────────── what exists without asking a server ───────────────────────────── */

const ACTIONS: readonly Command[] = [
  { id: 'action-new-appointment', group: 'action', label: 'Nová objednávka', hint: 'Otevře kalendář na nejbližším volném termínu', to: '/planovani', state: { newAppointment: NOW }, keywords: ['rezervace', 'termín', 'objednat', 'nový'], boost: 6 },
  { id: 'action-new-patient', group: 'action', label: 'Nový pacient', hint: 'Plná registrace pacienta', to: '/patients/register', requires: 'patients.register', keywords: ['registrace', 'karta', 'přidat'], boost: 6 },
  { id: 'action-quick-registration', group: 'action', label: 'Rychlá registrace', hint: 'Čtyři údaje a hotovo, zbytek doplní pacient', to: '/patients/register?mode=quick', requires: 'patients.register', keywords: ['pacient', 'odkaz'], boost: 4 },
  { id: 'action-club-order', group: 'action', label: 'Klubová objednávka', hint: 'Hromadná objednávka pro tým', to: '/planovani', state: { openClubOrder: true }, keywords: ['klub', 'tým', 'hromadná'], boost: 4 },
];

const PARENT_LABEL: Record<string, string> = {
  '/planovani': 'Kalendář',
  '/patients': 'Pacienti',
  '/clubs': 'Kluby a týmy',
  '/billing': 'Fakturace',
};

const TOP_LEVEL_PATH: Record<string, string> = { Přehled: '/prehled', Kalendář: '/planovani', Pacienti: '/patients', 'Kluby a týmy': '/clubs', Fakturace: '/billing', Nastavení: '/settings' };
const TOP_LEVEL = new Set(Object.keys(TOP_LEVEL_PATH));

/** The first-level screens and every child the sidebar lists - one list, so the palette and the menu cannot disagree. */
const PAGES: readonly Command[] = [
  { id: 'page-dashboard', group: 'page', label: 'Přehled', hint: 'Úvodní plocha', to: '/prehled', keywords: ['domů', 'plocha', 'dashboard'] },
  { id: 'page-calendar', group: 'page', label: 'Kalendář', hint: 'Termíny a plánování', to: '/planovani', keywords: ['termíny', 'plánování'] },
  { id: 'page-patients', group: 'page', label: 'Pacienti', hint: 'Kartotéka kliniky', to: '/patients', requires: 'patients.view', keywords: ['kartotéka', 'registr'] },
  { id: 'page-clubs', group: 'page', label: 'Kluby a týmy', hint: 'Hromadné objednávky a odkazy pro sportovce', to: '/clubs' },
  { id: 'page-billing', group: 'page', label: 'Fakturace', hint: 'Doklady a platby', to: '/billing', requires: 'billing.manage', keywords: ['faktury', 'platby'] },
  { id: 'page-settings', group: 'page', label: 'Nastavení', hint: 'Konfigurace kliniky', to: '/settings', keywords: ['konfigurace'] },
  ...(Object.entries(SECTION_CHILDREN) as [string, (typeof SECTION_CHILDREN)['/billing']][]).flatMap(([parent, children]) =>
    children
      .filter((child) => child.shortcut !== true)
      .map<Command>((child) => ({
        id: `page-${child.path}`,
        group: 'page',
        /* "Fakturace" is both the money screen and a club's invoicing: the second says whose. */
        label: TOP_LEVEL.has(child.text) && child.path !== TOP_LEVEL_PATH[child.text] ? `${child.text} · ${PARENT_LABEL[parent]}` : child.text,
        hint: PARENT_LABEL[parent],
        to: child.path,
        state: child.state as Record<string, unknown> | undefined,
        requires: child.requires,
      })),
  ),
];

/** Actions and pages the person may open (one row per address; the first label wins a duplicate). */
export function staticCommands(held: readonly string[]): Command[] {
  const allowed = (c: Command) => c.requires === undefined || held.includes(c.requires);
  const seen = new Set<string>();
  const out: Command[] = [];
  for (const c of [...ACTIONS, ...PAGES]) {
    if (!allowed(c)) continue;
    /* Same address and state = the same thing: an action wins over the page it opens ("Nový pacient"). */
    const key = `${c.to}|${JSON.stringify(c.state ?? null)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** An entity as a palette row. `hint` is a short, non-identifying line (a date, a status, a city). */
export function entityCommand(ref: EntityRef, hint?: string): Command {
  const target = entityTarget(ref);
  return { id: `${ref.kind}-${ref.id}`, group: ref.kind, label: ref.label, hint, to: target.to, state: target.state, entity: ref };
}

/* ───────────────────────────── what is shown before anything is typed ───────────────────────────── */

export interface CommandSection {
  id: string;
  title: string;
  commands: Command[];
}

/** How many rows each empty-query section shows. */
export const EMPTY_VIEW_LIMITS = { actions: 4, pinned: 4, recents: 5, pages: 5 } as const;

/** The palette's opening view: quick actions, pinned, recent, then a few places to go. Permission-filtered. */
export function emptyView(held: readonly string[], context: RankContext = {}): CommandSection[] {
  const statics = staticCommands(held);
  const open = (e: EntityRef) => mayOpen(e.kind, held);
  const sections: CommandSection[] = [
    { id: 'actions', title: 'Rychlé akce', commands: statics.filter((c) => c.group === 'action').slice(0, EMPTY_VIEW_LIMITS.actions) },
    { id: 'pinned', title: 'Připnuté', commands: (context.pinned ?? []).filter(open).slice(0, EMPTY_VIEW_LIMITS.pinned).map((e) => entityCommand(e, ENTITY_PLURAL[e.kind])) },
    { id: 'recents', title: 'Naposledy otevřené', commands: (context.recents ?? []).filter(open).slice(0, EMPTY_VIEW_LIMITS.recents).map((e) => entityCommand(e, ENTITY_PLURAL[e.kind])) },
    { id: 'pages', title: 'Přejít na', commands: statics.filter((c) => c.group === 'page').slice(0, EMPTY_VIEW_LIMITS.pages) },
  ];
  return sections.filter((s) => s.commands.length > 0);
}

/* ───────────────────────────── grouping the answers ───────────────────────────── */

const GROUP_TITLE: Record<CommandGroup, string> = {
  action: 'Akce',
  page: 'Stránky',
  settings: 'Nastavení',
  patient: ENTITY_PLURAL.patient,
  club: ENTITY_PLURAL.club,
  order: ENTITY_PLURAL.order,
  appointment: ENTITY_PLURAL.appointment,
  invoice: ENTITY_PLURAL.invoice,
  document: ENTITY_PLURAL.document,
  service: ENTITY_PLURAL.service,
  activity: ENTITY_PLURAL.activity,
  calendar: ENTITY_PLURAL.calendar,
  worker: ENTITY_PLURAL.worker,
};

/** Per group, at most this many rows (the rest is behind "zobrazit vše" of the kind's own screen). */
export const GROUP_LIMIT = 5;

/**
 * Ranked commands as sections: a section appears at the rank of its best row, so the thing you most likely meant is
 * on top whatever its kind, and each section keeps its rows in score order.
 */
export function sectionsOf(ranked: readonly Command[]): CommandSection[] {
  const byGroup = new Map<CommandGroup, Command[]>();
  const firstSeen: CommandGroup[] = [];
  for (const c of ranked) {
    const list = byGroup.get(c.group);
    if (list === undefined) {
      byGroup.set(c.group, [c]);
      firstSeen.push(c.group);
    } else if (list.length < GROUP_LIMIT) list.push(c);
  }
  return firstSeen.map((g) => ({ id: g, title: GROUP_TITLE[g], commands: byGroup.get(g) ?? [] }));
}

/** The flat order the arrow keys walk: the sections' rows, top to bottom. */
export const flatten = (sections: readonly CommandSection[]): Command[] => sections.flatMap((s) => s.commands);

/** Arrow-key movement over `count` rows, wrapping at both ends; `count` 0 stays at 0. */
export function moveIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
