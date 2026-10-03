/*
 * The arithmetic and the wording behind the club-block screens. Pure, so the
 * tests can say exactly what a sentence reads like and which draft is refused.
 *
 * Czech typography: a non-breaking space before "min" and "Kč", the thousands
 * separator `Intl` writes for `cs-CZ` (also a non-breaking space).
 */
import type { ActivitySeat, BlockAnalysis, Calculation, ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
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
  /** Text: a half-typed field is allowed. The legacy single headcount (a server without `analysis`). */
  playerCount: string;
  /** Seats per chosen činnost, as typed. When present, it replaces `playerCount`. */
  seats?: Record<string, string>;
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
  if (draft.seats === undefined) {
    if (parsePlayerCount(draft.playerCount) === null) errors.playerCount = 'Zadejte počet hráčů (celé číslo od 1).';
  } else if (draft.activityIds.some((id) => parsePlayerCount(draft.seats?.[id] ?? '') === null)) {
    errors.playerCount = 'Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.';
  }

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

/* ── Several ranges in one booking ── */

/** One row of "Termíny bloku": the days and the optional daily window. */
export interface RangeRow {
  /** Local key, never sent. */
  key: string;
  fromDate: string;
  toDate: string;
  dailyFrom: string;
  dailyTo: string;
}

export type RowErrors = Partial<Record<'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo' | 'overlap' | 'past', string>>;

/** Today's date in Prague, yyyy-MM-dd (the clinic's calendar day, whatever the browser's zone is). */
export function todayInPrague(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The day after a yyyy-MM-dd date; '' for anything else. */
export function nextDay(date: string): string {
  if (!DATE.test(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Field errors of one row (dates and daily window); the same sentences as the single range had. */
export function validateRow(row: Pick<RangeRow, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>): RowErrors {
  const errors: RowErrors = {};
  if (!DATE.test(row.fromDate)) errors.fromDate = 'Zadejte první den bloku.';
  if (!DATE.test(row.toDate)) errors.toDate = 'Zadejte poslední den bloku.';
  else if (DATE.test(row.fromDate) && row.toDate < row.fromDate) errors.toDate = 'Konec nesmí být před začátkem.';
  const from = row.dailyFrom.trim();
  const to = row.dailyTo.trim();
  if ((from === '') !== (to === '')) errors.dailyFrom = 'Vyplňte obě hodiny denního okna, nebo žádnou.';
  else if (from !== '') {
    if (!TIME.test(from) || !TIME.test(to)) errors.dailyFrom = 'Čas zadejte jako HH:mm.';
    else if (to <= from) errors.dailyTo = 'Okno musí končit později, než začíná.';
  }
  return errors;
}

/** True when the row starts before `today`. */
export const startsInPast = (row: Pick<RangeRow, 'fromDate'>, today: string): boolean => DATE.test(row.fromDate) && row.fromDate < today;

/** The row with its start moved to today (and its end too when that was earlier). */
export function moveToToday<T extends Pick<RangeRow, 'fromDate' | 'toDate'>>(row: T, today: string): T {
  return { ...row, fromDate: today, toDate: DATE.test(row.toDate) && row.toDate < today ? today : row.toDate };
}

/** Per row: the first other row it overlaps, as "Tento termín se překrývá s řádkem N" (N counts from 1). */
export function overlapErrors(rows: readonly Pick<RangeRow, 'fromDate' | 'toDate'>[]): (string | undefined)[] {
  const valid = (r: Pick<RangeRow, 'fromDate' | 'toDate'>) => DATE.test(r.fromDate) && DATE.test(r.toDate) && r.toDate >= r.fromDate;
  return rows.map((a, i) => {
    if (!valid(a)) return undefined;
    const j = rows.findIndex((b, k) => k !== i && valid(b) && a.fromDate <= b.toDate && b.fromDate <= a.toDate);
    return j === -1 ? undefined : `Tento termín se překrývá s řádkem ${j + 1}`;
  });
}

/** Rows ordered by their first day (rows without a valid day keep their place at the end). */
export function sortRows<T extends Pick<RangeRow, 'fromDate'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const av = DATE.test(a.fromDate);
    const bv = DATE.test(b.fromDate);
    if (av && bv) return a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : 0;
    return av === bv ? 0 : av ? -1 : 1;
  });
}

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Open minutes the rows give together: per row, the `perDay` entries of that
 * row's own calculation that fall inside its days, each capped by the row's
 * daily window when it has one. `perDayOf(i)` is row i's answer (undefined = unknown yet).
 */
export function coveredMinutes(
  rows: readonly Pick<RangeRow, 'fromDate' | 'toDate' | 'dailyFrom' | 'dailyTo'>[],
  perDayOf: (index: number) => readonly { date: string; openMinutes: number }[] | undefined,
): number {
  let sum = 0;
  rows.forEach((row, i) => {
    if (!DATE.test(row.fromDate) || !DATE.test(row.toDate) || row.toDate < row.fromDate) return;
    const window = row.dailyFrom.trim() !== '' && row.dailyTo.trim() !== '' && TIME.test(row.dailyFrom) && TIME.test(row.dailyTo) && row.dailyTo > row.dailyFrom
      ? minutesOf(row.dailyTo) - minutesOf(row.dailyFrom)
      : null;
    for (const day of perDayOf(i) ?? []) {
      if (day.date < row.fromDate || day.date > row.toDate) continue;
      sum += window === null ? day.openMinutes : Math.min(day.openMinutes, window);
    }
  });
  return sum;
}


/* ── Seats per činnost: the club as one whole ── */

/** The seats of the chosen činnosti as numbers, in the order of `ids`; `null` while a field is empty or invalid. */
export function seatsOf(ids: readonly string[], typed: Readonly<Record<string, string>>): (number | null)[] {
  return ids.map((id) => parsePlayerCount(typed[id] ?? ''));
}

/** The sum of the valid seats (an empty or invalid field adds nothing). */
export function sumSeats(ids: readonly string[], typed: Readonly<Record<string, string>>): number {
  return seatsOf(ids, typed).reduce<number>((n, v) => n + (v ?? 0), 0);
}

/** Every chosen činnost has valid seats, and there is at least one. */
export function allSeatsValid(ids: readonly string[], typed: Readonly<Record<string, string>>): boolean {
  return ids.length > 0 && seatsOf(ids, typed).every((v) => v !== null);
}

/** The body's `activitySeats` (valid rows only, in the order of `ids`). */
export function seatsPayload(ids: readonly string[], typed: Readonly<Record<string, string>>): ActivitySeat[] {
  return ids.flatMap((activityId) => {
    const seats = parsePlayerCount(typed[activityId] ?? '');
    return seats === null ? [] : [{ activityId, seats }];
  });
}

/** "2 činnosti", "5 činností". */
export const formatActivities = (n: number): string => `${n} ${plural(n, ['činnost', 'činnosti', 'činností'])}`;

export interface SeatFill {
  /** Seats per činnost id (0 = nothing of it fits). */
  seats: Record<string, number>;
  mode: 'single' | 'proportional' | 'equal';
  /** The sentence shown beside the button. */
  message: string;
}

/**
 * "Spočítat počet hráčů z vybraného času": the seats from the time the analysis
 * says is available. One činnost gets what fits alone in the windows
 * (`maxSeatsInWindowsAlone`). Several share the available minutes: in the
 * proportion of the seats typed so far when every činnost has some, else
 * equally. A činnost's share of the minutes, times its parallel capacity,
 * divided by the minutes one seat takes, rounded down.
 */
export function fillSeatsFromWindow(
  analysis: Pick<BlockAnalysis, 'availableMinutes' | 'perActivity'>,
  ids: readonly string[],
  typed: Readonly<Record<string, string>>,
): SeatFill | null {
  const rows = ids.flatMap((id) => analysis.perActivity.filter((a) => a.activityId === id));
  if (rows.length === 0 || rows.length !== ids.length) return null;
  if (rows.length === 1) {
    const only = rows[0];
    return {
      seats: { [only.activityId]: only.maxSeatsInWindowsAlone },
      mode: 'single',
      message: `Nastaveno podle vybraného času: ${formatPlayers(only.maxSeatsInWindowsAlone)}.`,
    };
  }
  const typedSeats = seatsOf(ids, typed);
  const proportional = typedSeats.every((v) => v !== null);
  const weights = proportional ? (typedSeats as number[]) : ids.map(() => 1);
  const total = weights.reduce((n, w) => n + w, 0);
  const seats: Record<string, number> = {};
  rows.forEach((row, i) => {
    const minutes = (analysis.availableMinutes * weights[i]) / total;
    seats[row.activityId] = row.minutesPerSeat > 0 ? Math.max(0, Math.floor((minutes * row.parallelCapacity) / row.minutesPerSeat)) : 0;
  });
  return {
    seats,
    mode: proportional ? 'proportional' : 'equal',
    message: proportional
      ? `Rozděleno v poměru zadaných míst mezi ${formatActivities(rows.length)} — upravte podle klubu.`
      : `Rozděleno rovným dílem mezi ${formatActivities(rows.length)} — upravte podle klubu.`,
  };
}

/** "09:40–10:40" for a valid daily window, else null. */
export function windowLabel(row: Pick<RangeRow, 'dailyFrom' | 'dailyTo'>): string | null {
  const from = row.dailyFrom.trim();
  const to = row.dailyTo.trim();
  return TIME.test(from) && TIME.test(to) && to > from ? `${from}–${to}` : null;
}

/** The sentence under a range row: what the analysis counts. */
export function countingSentence(row: Pick<RangeRow, 'dailyFrom' | 'dailyTo'>): string {
  const from = row.dailyFrom.trim();
  const to = row.dailyTo.trim();
  return windowLabel(row) !== null ? `Počítá se od ${from} do ${to}` : 'Počítá se celá otevírací doba';
}
