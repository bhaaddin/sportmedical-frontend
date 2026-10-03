/*
 * The arithmetic and the wording behind the club-block screens. Pure, so the
 * tests can say exactly what a sentence reads like and which draft is refused.
 *
 * Czech typography: a non-breaking space before "min" and "Kč", the thousands
 * separator `Intl` writes for `cs-CZ` (also a non-breaking space).
 */
import type { Calculation, ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { formatDateRange } from '../../pages/clubs/clubOrders';

const NBSP = ' ';

/** Czech plural: 1 → one, 2-4 → few, everything else → many. */
export function plural(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  if (abs >= 2 && abs <= 4) return forms[1];
  return forms[2];
}

/** "3 600 min" - the number grouped, the unit glued to it. */
export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes).toLocaleString('cs-CZ')}${NBSP}min`;
}

/** "120 hráčů". */
export function formatPlayers(n: number): string {
  return `${n.toLocaleString('cs-CZ')} ${plural(n, ['hráč', 'hráči', 'hráčů'])}`;
}

/** "26. 10." for a yyyy-MM-dd date. */
export function formatDayMonth(date: string | null | undefined): string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [, m, d] = date.split('-').map(Number);
  return `${d}. ${m}.`;
}

/** "po 26. 10." - weekday in lower case, the way a list line is written. */
export function formatWeekdayDayMonth(date: string): string {
  const names = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${names[new Date(y, m - 1, d).getDay()]} ${d}. ${m}.`;
}

/** "26. 10. – 3. 11." */
export function formatShortSpan(from: string | null, to: string | null): string {
  if (from === null || to === null) return '';
  const a = formatDayMonth(from);
  const b = formatDayMonth(to);
  return from === to ? a : `${a} – ${b}`;
}

/**
 * The calculator's headline:
 * "120 hráčů × 60 min ÷ 2 stanoviště = 3 600 min → 7 dní, 26. 10. – 3. 11."
 */
export function calculationSentence(playerCount: number, calc: Calculation): string {
  const stations = `${calc.parallelCapacity} ${plural(calc.parallelCapacity, ['stanoviště', 'stanoviště', 'stanovišť'])}`;
  const left = `${formatPlayers(playerCount)} × ${formatMinutes(calc.minutesPerPlayer)} ÷ ${stations} = ${formatMinutes(calc.neededMinutes)}`;
  if (calc.suggestedDays <= 0) return left;
  const days = `${calc.suggestedDays} ${plural(calc.suggestedDays, ['den', 'dny', 'dní'])}`;
  const span = formatShortSpan(calc.suggestedFrom, calc.suggestedTo);
  return `${left} → ${days}${span === '' ? '' : `, ${span}`}`;
}

/* ── The draft ── */

export interface BlockDraft {
  clubId: string;
  name: string;
  calendarIds: string[];
  activityIds: string[];
  fromDate: string;
  toDate: string;
  dailyFrom: string;
  dailyTo: string;
  /** Text: a half-typed field is allowed. */
  playerCount: string;
  note: string;
}

export type BlockErrors = Partial<Record<keyof BlockDraft | 'newClub', string>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The headcount as typed: a whole number from 1 up, no ceiling (the clinic sets none). */
export function parsePlayerCount(text: string): number | null {
  const t = text.replace(/\s/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * What stops a draft from being sent. `clubReady` says whether a club is
 * chosen or a new one is filled in far enough (the dialog checks the club's own
 * fields itself); `editing` relaxes the lists that a PUT cannot change.
 */
export function validateBlockDraft(draft: BlockDraft, clubReady: boolean, editing: boolean): BlockErrors {
  const errors: BlockErrors = {};
  if (!clubReady && !editing) errors.clubId = 'Vyberte klub nebo založte nový.';
  if (!DATE.test(draft.fromDate)) errors.fromDate = 'Zadejte první den bloku.';
  if (!DATE.test(draft.toDate)) errors.toDate = 'Zadejte poslední den bloku.';
  else if (DATE.test(draft.fromDate) && draft.toDate < draft.fromDate) errors.toDate = 'Konec nesmí být před začátkem.';
  if (!editing) {
    if (draft.calendarIds.length === 0) errors.calendarIds = 'Vyberte aspoň jeden kalendář.';
    if (draft.activityIds.length === 0) errors.activityIds = 'Vyberte aspoň jednu činnost.';
  }
  if (parsePlayerCount(draft.playerCount) === null) errors.playerCount = 'Zadejte počet hráčů (celé číslo od 1).';

  const from = draft.dailyFrom.trim();
  const to = draft.dailyTo.trim();
  if ((from === '') !== (to === '')) {
    errors.dailyFrom = 'Vyplňte obě hodiny denního okna, nebo žádnou.';
  } else if (from !== '') {
    if (!TIME.test(from) || !TIME.test(to)) errors.dailyFrom = 'Čas zadejte jako HH:mm.';
    else if (to <= from) errors.dailyTo = 'Okno musí končit později, než začíná.';
  }
  return errors;
}

export const hasBlockErrors = (errors: BlockErrors): boolean => Object.keys(errors).length > 0;

/* ── Showing a block ── */

/** "26.—27. října 2026". */
export function blockRange(block: Pick<ClubBlockView, 'fromDate' | 'toDate'>): string {
  return formatDateRange(block.fromDate, block.toDate);
}

export const blockFree = (block: Pick<ClubBlockView, 'seats' | 'registered'>): number => Math.max(0, block.seats - block.registered);

export const blockPercent = (block: Pick<ClubBlockView, 'seats' | 'registered'>): number =>
  block.seats > 0 ? Math.min(100, (block.registered / block.seats) * 100) : 0;

/** A readable name for a block: its own name, else the club's. */
export const blockTitle = (block: Pick<ClubBlockView, 'name' | 'clubName'>): string => block.name ?? block.clubName;

/** The colour a club is drawn in: its own, else the one its blocks carry, else nothing. */
export function clubColorOf(
  club: { id: string; colorHex?: string | null },
  blocks: readonly Pick<ClubBlockView, 'clubId' | 'colorHex'>[],
): string | null {
  if (typeof club.colorHex === 'string' && club.colorHex !== '') return club.colorHex;
  return blocks.find((b) => b.clubId === club.id && b.colorHex)?.colorHex ?? null;
}

/** Black or white, whichever reads on the colour. A hex the server sent, never one of ours. */
export function inkOn(hex: string): '#14181C' | '#FFFFFF' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return '#14181C';
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? '#14181C' : '#FFFFFF';
}

/** "Jan Novák · Komplexní prohlídka · po 26. 10. 11:00" for a conflict line. */
export function conflictLine(c: ClubBlockConflict, when: (iso: string) => string): string {
  return [c.name, c.activityName, c.startUtc ? when(c.startUtc) : null].filter((p) => p !== null && p !== '').join(' · ');
}

/** The initials of a club, for an avatar. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
