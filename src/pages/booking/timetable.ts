import type {
  SchedulePeriod,
  WorkingHour,
  WorkingHourInput,
} from '../../api/bookingContracts';
import { addDaysToDateOnly, dayOfWeekOf, type DateOnly } from '../../utils/time';

/*
 * One timetable per calendar, optionally different in alternating weeks.
 *
 * ── What the owner asked for ──
 *
 * "Pracovní doba musí být jednoduchá: pro zaměstnance, po dnech, případně
 * jinak v lichém a sudém týdnu." The validity periods ("Zimní provoz") that the
 * previous screen was built around are not something this clinic uses.
 *
 * ── What the backend still needs ──
 *
 * Every working-hour row hangs off a SchedulePeriod, and the week cycle is
 * counted from the Monday of the period's `validFrom` (contract 4.2). So one
 * period stays, created on first save and never shown, and the screen speaks
 * only of weeks A and B - whose real dates always come from the server's
 * `…/cycle` answer, never from a count done here.
 *
 * ── How rows map to what is on screen ──
 *
 *   every week        repeatEveryNWeeks 1, weekOffset 0
 *   week A            repeatEveryNWeeks 2, weekOffset 0   (the period's first week)
 *   week B            repeatEveryNWeeks 2, weekOffset 1
 *
 * The backend resolves a day to the FIRST row that applies (DayScheduleRule),
 * so a weekday effectively has one shift per week kind. Two rows for the same
 * week kind, or a "every third week" row, cannot be shown faithfully here: the
 * day says so and keeps its rows until somebody edits that day.
 */

/** The name of the period the screen keeps behind the scenes. Never shown. */
export const DEFAULT_PERIOD_NAME = 'Pracovní doba';

/** Displayed Monday first, stored 0 = Sunday as .NET spells it. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export interface Shift {
  working: boolean;
  start: string;
  end: string;
  breakStart: string | null;
  breakEnd: string | null;
  workerUserId: string | null;
}

export interface DayPlan {
  dayOfWeek: number;
  /** Every week, or week A when the timetable alternates. */
  a: Shift;
  /** Week B. Kept in step with A while the timetable does not alternate. */
  b: Shift;
  /**
   * The saved rows say something this screen cannot draw - every third week,
   * two rows for one week kind. Saving that day replaces them.
   */
  unsupported: boolean;
}

export interface Timetable {
  alternating: boolean;
  days: DayPlan[];
}

/** A day nobody has set up yet: off, with a sensible starting point for the times. */
export const OFF_SHIFT: Shift = {
  working: false,
  start: '08:00',
  end: '16:00',
  breakStart: null,
  breakEnd: null,
  workerUserId: null,
};

const hhmm = (time: string): string => time.slice(0, 5);

function shiftOf(row: WorkingHour): Shift {
  return {
    working: true,
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
    breakStart: row.breakStart ? hhmm(row.breakStart) : null,
    breakEnd: row.breakEnd ? hhmm(row.breakEnd) : null,
    workerUserId: row.workerUserId,
  };
}

type Slot = 'every' | 'a' | 'b';

function slotOf(row: WorkingHour): Slot | null {
  if (row.repeatEveryNWeeks === 1) return 'every';
  if (row.repeatEveryNWeeks === 2) return row.weekOffset === 0 ? 'a' : 'b';
  return null;
}

const CYCLE_OF: Record<Slot, { repeatEveryNWeeks: number; weekOffset: number }> = {
  every: { repeatEveryNWeeks: 1, weekOffset: 0 },
  a: { repeatEveryNWeeks: 2, weekOffset: 0 },
  b: { repeatEveryNWeeks: 2, weekOffset: 1 },
};

/** What the saved rows of one calendar period look like on this screen. */
export function timetableFrom(rows: readonly WorkingHour[]): Timetable {
  const alternating = rows.some((row) => row.repeatEveryNWeeks === 2);

  const days = WEEK_DAYS.map((dayOfWeek): DayPlan => {
    const mine = rows.filter((row) => row.dayOfWeek === dayOfWeek);
    const bySlot = (slot: Slot) => mine.filter((row) => slotOf(row) === slot);

    const every = bySlot('every');
    const a = bySlot('a');
    const b = bySlot('b');
    const other = mine.filter((row) => slotOf(row) === null);

    const unsupported =
      other.length > 0 ||
      every.length > 1 ||
      a.length > 1 ||
      b.length > 1 ||
      (every.length > 0 && a.length + b.length > 0);

    const aRow = a[0] ?? every[0] ?? other[0];
    const bRow = alternating ? (b[0] ?? every[0]) : aRow;

    return {
      dayOfWeek,
      a: aRow ? shiftOf(aRow) : { ...OFF_SHIFT },
      b: bRow ? shiftOf(bRow) : { ...OFF_SHIFT },
      unsupported,
    };
  });

  return { alternating, days };
}

export function sameShift(left: Shift, right: Shift): boolean {
  return (
    left.working === right.working &&
    left.start === right.start &&
    left.end === right.end &&
    left.breakStart === right.breakStart &&
    left.breakEnd === right.breakEnd &&
    left.workerUserId === right.workerUserId
  );
}

function inputFor(dayOfWeek: number, shift: Shift, slot: Slot): WorkingHourInput {
  return {
    dayOfWeek,
    startTime: shift.start,
    endTime: shift.end,
    breakStart: shift.breakStart,
    breakEnd: shift.breakEnd,
    workerUserId: shift.workerUserId,
    isActive: true,
    ...CYCLE_OF[slot],
  };
}

/**
 * The rows one day should have.
 *
 * A day that is the same in both weeks is stored as one every-week row even
 * when the timetable alternates, so the data stays as simple as the day is.
 */
export function rowsForDay(day: DayPlan, alternating: boolean): WorkingHourInput[] {
  if (!alternating || sameShift(day.a, day.b)) {
    return day.a.working ? [inputFor(day.dayOfWeek, day.a, 'every')] : [];
  }

  return [
    ...(day.a.working ? [inputFor(day.dayOfWeek, day.a, 'a')] : []),
    ...(day.b.working ? [inputFor(day.dayOfWeek, day.b, 'b')] : []),
  ];
}

/** Turning alternation on starts week B as a copy of week A; off keeps week A. */
export function setAlternating(timetable: Timetable, alternating: boolean): Timetable {
  return {
    alternating,
    days: timetable.days.map((day) => ({ ...day, b: { ...day.a } })),
  };
}

export type SaveOp =
  | { kind: 'delete'; id: string }
  | { kind: 'update'; id: string; input: WorkingHourInput }
  | { kind: 'create'; input: WorkingHourInput };

const cycleKey = (row: { repeatEveryNWeeks: number; weekOffset: number }) =>
  `${row.repeatEveryNWeeks}/${row.weekOffset}`;

function differs(row: WorkingHour, input: WorkingHourInput): boolean {
  const saved = shiftOf(row);
  return !sameShift(saved, {
    working: true,
    start: input.startTime,
    end: input.endTime,
    breakStart: input.breakStart,
    breakEnd: input.breakEnd,
    workerUserId: input.workerUserId,
  });
}

/**
 * What to send to turn the saved rows into the edited timetable.
 *
 * Only days the owner actually changed are touched - a day whose rows this
 * screen cannot draw faithfully stays exactly as it is until somebody edits it.
 *
 * Deletes go first, then updates, then creates. The server refuses two rows
 * that could apply on the same day (409), and going from alternating weeks
 * back to every week is exactly such a pair until the old week-B row is gone.
 */
export function planSave(
  saved: readonly WorkingHour[],
  initial: Timetable,
  edited: Timetable,
): SaveOp[] {
  const deletes: SaveOp[] = [];
  const updates: SaveOp[] = [];
  const creates: SaveOp[] = [];

  for (const day of edited.days) {
    const before = initial.days.find((d) => d.dayOfWeek === day.dayOfWeek);
    const wanted = rowsForDay(day, edited.alternating);

    if (
      before &&
      JSON.stringify(rowsForDay(before, initial.alternating)) === JSON.stringify(wanted)
    ) {
      continue;
    }

    const existing = saved.filter((row) => row.dayOfWeek === day.dayOfWeek);
    const unmatched = [...existing];

    for (const input of wanted) {
      const index = unmatched.findIndex((row) => cycleKey(row) === cycleKey(input));

      if (index === -1) {
        creates.push({ kind: 'create', input });
        continue;
      }

      const [row] = unmatched.splice(index, 1);
      if (differs(row, input)) updates.push({ kind: 'update', id: row.id, input });
    }

    for (const row of unmatched) deletes.push({ kind: 'delete', id: row.id });
  }

  return [...deletes, ...updates, ...creates];
}

/** Why a shift cannot be saved, in words for the person at the screen, or null. */
export function shiftProblem(shift: Shift): string | null {
  if (!shift.working) return null;
  if (!shift.start || !shift.end) return 'Vyplňte začátek i konec.';
  if (shift.start >= shift.end) return 'Konec musí být později než začátek.';

  const hasStart = shift.breakStart !== null && shift.breakStart !== '';
  const hasEnd = shift.breakEnd !== null && shift.breakEnd !== '';

  if (hasStart !== hasEnd) return 'Pauza potřebuje začátek i konec, nebo ani jedno.';
  if (!hasStart) return null;

  if ((shift.breakStart as string) >= (shift.breakEnd as string)) {
    return 'Pauza musí skončit později, než začne.';
  }
  if ((shift.breakStart as string) < shift.start || (shift.breakEnd as string) > shift.end) {
    return 'Pauza musí ležet uvnitř pracovní doby.';
  }

  return null;
}

/* ── The period behind the scenes ── */

const coversDate = (period: SchedulePeriod, date: DateOnly): boolean =>
  period.validFrom <= date && (period.validTo === null || date <= period.validTo);

/**
 * Which saved period is "the timetable": the one in force today, else the
 * next one to start. The rest are left-overs from the old period screen and
 * are listed so they are not silently in force on some future date.
 */
export function pickPeriod(
  periods: readonly SchedulePeriod[],
  today: DateOnly,
): { main: SchedulePeriod | null; others: SchedulePeriod[] } {
  const sorted = [...periods].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const main =
    sorted.find((period) => coversDate(period, today)) ??
    sorted.find((period) => period.validFrom > today) ??
    null;

  return { main, others: sorted.filter((period) => period !== main) };
}

/** Monday of the week a date falls in - the first day of the default period. */
export function mondayOf(date: DateOnly): DateOnly {
  return addDaysToDateOnly(date, -((dayOfWeekOf(date) + 6) % 7));
}

/**
 * Where the default period starts: this week's Monday, so that "week A" is
 * the current week - unless an old period still runs past it, since two
 * periods of one calendar may not overlap (409).
 */
export function defaultPeriodStart(periods: readonly SchedulePeriod[], today: DateOnly): DateOnly {
  const monday = mondayOf(today);
  const lastEnd = periods
    .map((period) => period.validTo)
    .filter((end): end is string => end !== null && end >= monday)
    .sort()
    .at(-1);

  return lastEnd ? addDaysToDateOnly(lastEnd, 1) : monday;
}
