/*
 * R17 - the lunch (OBĚD) band of the main calendar as something the desk can change for ONE day.
 *
 * The weekly lunch (a working-hours row's break, else the clinic's default lunch) is never touched here. A click on the band offers
 *   Přesunout           a new start (time box or drag), any time of the day, same duration, refused over a booking
 *   Smazat jen dnes     no lunch that day (it can be brought back)
 *   Objednat pacienta   books into the lunch slot for that day only (the day's lunch goes, the booking comes)
 * and the day shows what was done: "OBĚD · přesunut" / "OBĚD · smazán dnes".
 *
 * Pure rules, no DOM: the band as the day mark describes it, the arithmetic of a move and its checks (the server repeats them and has
 * the last word: `lunch.overlaps_booking`, `lunch.overlaps_club`, `lunch.outside_hours`).
 */
import { parseTimeOfDay } from '../../../components/booking/grid/timeRange';
import type { DayMark } from '../../model';

export type LunchState = 'weekly' | 'moved' | 'removed';

export interface LunchBand {
  day: string;
  /** HH:mm - where the lunch is now (for a removed one: where it used to be). */
  from: string;
  to: string;
  state: LunchState;
  /** A moved lunch: where the weekly lunch sits. */
  original: { from: string; to: string } | null;
}

export const LUNCH_TEXT = {
  band: 'Oběd',
  moved: 'Oběd · přesunut',
  removed: 'Oběd · smazán dnes',
  title: (date: string) => `Oběd · ${date}`,
  onlyToday: 'Platí jen pro tento den, týdenní oběd se nemění.',
  move: 'Přesunout',
  moveGo: 'Přesunout oběd',
  startLabel: 'Nový začátek oběda',
  dragHint: 'Oběd lze také přetáhnout přímo v kalendáři.',
  removeToday: 'Smazat jen dnes',
  bookHere: 'Objednat pacienta sem',
  restore: 'Vrátit na původní čas',
  restoreRemoved: 'Vrátit oběd',
  original: (from: string, to: string) => `Původně ${from}–${to}`,
  chooseCalendar: 'Kalendář',
  working: 'Ukládám…',
  close: 'Zavřít',
  done: { moved: 'Oběd přesunut jen pro tento den.', removed: 'Oběd je pro tento den smazán.', restored: 'Oběd je zpět na původním čase.' },
  partial: (done: number, total: number) => `Změna se povedla jen u ${done} z ${total} kalendářů. Zkontrolujte den a zopakujte ji.`,
  overlapBooking: 'V tomto čase už je rezervace. Přesuňte nejdřív ji, nebo zvolte jiný čas oběda.',
  outsideHours: (from: string, to: string) => `Oběd musí zůstat v pracovní době (${from}–${to}).`,
  badStart: 'Zadejte čas začátku oběda, například 13:00.',
  weekly: {
    /** "každý pátek" - the weekday as the button and the sentence say it (0 = neděle). */
    every: ['každou neděli', 'každé pondělí', 'každé úterý', 'každou středu', 'každý čtvrtek', 'každý pátek', 'každou sobotu'] as readonly string[],
    go: (every: string) => `Přesunout ${every}`,
    hint: (every: string) => `„Přesunout oběd“ platí jen pro tento den. „Přesunout ${every}“ změní týdenní rozvrh všech otevřených kalendářů.`,
    done: (every: string) => `Oběd přesunut ${every}.`,
    noPeriod: 'Kalendář nemá pro tento den platný rozvrh. Upravte ho v Otevírací době.',
    noLunch: 'V týdenním rozvrhu tento den oběd nemá. Upravte ho v Otevírací době.',
  },
} as const;

/** The band a day mark describes, or null when the day has no lunch to click (closed, no hours, no lunch and none removed). */
export function lunchBandOf(day: string, mark: DayMark | undefined): LunchBand | null {
  if (!mark || mark.closed) return null;
  if (mark.lunch) {
    return { day, from: mark.lunch.from, to: mark.lunch.to, state: mark.lunch.moved ? 'moved' : 'weekly', original: mark.lunch.original ?? null };
  }
  if (mark.lunchRemoved) return { day, from: mark.lunchRemoved.from, to: mark.lunchRemoved.to, state: 'removed', original: null };
  return null;
}

export const clockOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** "13:00" / "13:0" / "1300" -> minutes of the day, or null. */
export function startMinutesOf(text: string): number | null {
  const t = text.trim();
  const direct = parseTimeOfDay(t.length === 4 && /^\d:\d\d$/.test(t) ? `0${t}` : t);
  const found = direct ?? (() => {
    const m = /^(\d{1,2})(\d{2})$/.exec(t);
    return m ? parseTimeOfDay(`${m[1]!.padStart(2, '0')}:${m[2]}`) : null;
  })();
  return found !== null && found < 24 * 60 ? found : null;
}

export const lunchLength = (band: Pick<LunchBand, 'from' | 'to'>): number => (parseTimeOfDay(band.to) ?? 0) - (parseTimeOfDay(band.from) ?? 0);

export interface MoveCheckInput {
  /** The new start, minutes of the day. */
  start: number;
  /** Minutes the lunch lasts (unchanged by a move). */
  length: number;
  /** The day's opening hours HH:mm (of the calendars the move is made in); null = unknown. */
  hours: { from: string; to: string } | null;
  /** The bookings (not cancelled) of those calendars that day, as minutes of the day. */
  bookings: readonly { start: number; end: number }[];
}

/** What stops the lunch starting at `start`, in Czech, or null when nothing the browser can see does. */
export function checkLunchMove(input: MoveCheckInput): string | null {
  const { start, length } = input;
  const end = start + length;
  if (input.hours) {
    const from = parseTimeOfDay(input.hours.from);
    const to = parseTimeOfDay(input.hours.to);
    if (from !== null && to !== null && (start < from || end > to)) return LUNCH_TEXT.outsideHours(input.hours.from, input.hours.to);
  }
  if (input.bookings.some((b) => start < b.end && b.start < end)) return LUNCH_TEXT.overlapBooking;
  return null;
}

/** A dragged lunch: the pointer's shift in minutes, snapped to the grid step, clamped inside the day. */
export function draggedStart(originalStart: number, deltaMinutes: number, step: number, length: number): number {
  const snapped = originalStart + Math.round(deltaMinutes / Math.max(1, step)) * Math.max(1, step);
  return Math.min(Math.max(0, snapped), 24 * 60 - length);
}

/** The label of the band. */
export const lunchBandLabel = (state: LunchState): string => (state === 'moved' ? LUNCH_TEXT.moved : state === 'removed' ? LUNCH_TEXT.removed : LUNCH_TEXT.band);
