import type {
  DayActivityRow,
  DayAppointment,
  SchedulePeriod,
  SchedulePeriodInput,
  ScheduleExceptionInput,
  WorkingHour,
  WorkingHourInput,
} from '../../../api/bookingContracts';
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatDateOnly,
  formatPragueTime,
  parseDateOnly,
  pragueDateKey,
  type DateOnly,
} from '../../../utils/time';
import { shiftProblem, WEEK_DAYS } from '../../../pages/booking/timetable';

/*
 * "Rychlý plán" - the pure part: scope -> dates -> the payloads that set a
 * stretch of the calendar up in one go.
 *
 * ── What the backend allows (read from SchedulePlanService, 3. 10. 2026) ──
 *
 * Opening hours live in a schedule period, and two periods of one calendar may
 * NOT overlap: creating one inside another answers 409 "Období se překrývá".
 * Nothing is split or replaced by the server and nobody "wins". So a plan for
 * a month inside the year-round period cannot simply be added. What this file
 * does about it is `findConflicts` + `planOperations`: the covering period is
 * cut around the plan (head before it, tail after it, the tail a faithful copy
 * of the old hours and činnosti) - and the dialog shows exactly that and asks
 * for a confirmation before anything is touched.
 *
 * A single date is different: it is an exception (closed / other hours), which
 * has no činnosti and no break of its own - those come from the weekday.
 */

export type PlanScope = 'day' | 'week' | 'month' | 'custom';

export interface DateRange {
  from: DateOnly;
  to: DateOnly;
}

export interface ScopeInput {
  scope: PlanScope;
  /** Den: the date. Týden: any date inside the week. */
  date: string;
  /** Měsíc: `yyyy-MM`, as `<input type="month">` spells it. */
  month: string;
  from: string;
  to: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Monday of the week a date falls in. */
export function mondayOf(date: DateOnly): DateOnly {
  return addDaysToDateOnly(date, -((dayOfWeekOf(date) + 6) % 7));
}

/** The dates a scope selects, or null while the inputs do not make a valid range. */
export function scopeRange(input: ScopeInput): DateRange | null {
  switch (input.scope) {
    case 'day':
      return DATE_RE.test(input.date) ? { from: input.date, to: input.date } : null;
    case 'week': {
      if (!DATE_RE.test(input.date)) return null;
      const monday = mondayOf(input.date);
      return { from: monday, to: addDaysToDateOnly(monday, 6) };
    }
    case 'month': {
      if (!MONTH_RE.test(input.month)) return null;
      const [year, month] = input.month.split('-').map(Number);
      if (month < 1 || month > 12) return null;
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
    }
    case 'custom':
      return DATE_RE.test(input.from) && DATE_RE.test(input.to) && input.from <= input.to
        ? { from: input.from, to: input.to }
        : null;
  }
}

const parts = (date: DateOnly): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
};

/** `1. 10. – 31. 10. 2026`, `5. 10. 2026`, or both years when they differ. */
export function formatRange({ from, to }: DateRange): string {
  if (from === to) return formatDateOnly(from);
  const [fy, fm, fd] = parts(from);
  const [ty] = parts(to);
  if (fy === ty) return `${fd}. ${fm}. – ${formatDateOnly(to)}`;
  return `${formatDateOnly(from)} – ${formatDateOnly(to)}`;
}

/** The period name: `Plán 1.–31. 10. 2026`. */
export function planName({ from, to }: DateRange): string {
  if (from === to) return `Plán ${formatDateOnly(from)}`;
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (fy === ty && fm === tm) return `Plán ${fd}.–${td}. ${tm}. ${ty}`;
  if (fy === ty) return `Plán ${fd}. ${fm}. – ${td}. ${tm}. ${ty}`;
  return `Plán ${formatDateOnly(from)} – ${formatDateOnly(to)}`;
}

const SHORT_DAY: Record<number, string> = { 1: 'Po', 2: 'Út', 3: 'St', 4: 'Čt', 5: 'Pá', 6: 'So', 0: 'Ne' };
export const LONG_DAY: Record<number, string> = {
  1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota', 0: 'Neděle',
};

/** "z pondělí", "ze středy" - for the sentence about which weekday a single date borrows its činnosti from. */
export const FROM_DAY: Record<number, string> = {
  1: 'z pondělí', 2: 'z úterý', 3: 'ze středy', 4: 'ze čtvrtka', 5: 'z pátku', 6: 'ze soboty', 0: 'z neděle',
};

/** `Po–Pá`, `Po–St, Pá`, `Po, Út`. Monday first, Sunday last. */
export function weekdaysLabel(days: readonly number[]): string {
  const ordered = WEEK_DAYS.filter((day) => days.includes(day));
  if (ordered.length === 0) return 'žádný den';

  const runs: number[][] = [];
  for (const day of ordered) {
    const run = runs.at(-1);
    const position = (WEEK_DAYS as readonly number[]).indexOf(day);
    if (run && (WEEK_DAYS as readonly number[]).indexOf(run.at(-1) as number) === position - 1) run.push(day);
    else runs.push([day]);
  }

  return runs
    .map((run) =>
      run.length >= 3
        ? `${SHORT_DAY[run[0]]}–${SHORT_DAY[run.at(-1) as number]}`
        : run.map((day) => SHORT_DAY[day]).join(', '),
    )
    .join(', ');
}

/** `1 činnost`, `3 činnosti`, `8 činností`. */
export function activitiesCount(n: number): string {
  if (n === 0) return 'žádná činnost';
  if (n === 1) return '1 činnost';
  return n < 5 ? `${n} činnosti` : `${n} činností`;
}

export interface PlanDraft {
  range: DateRange;
  /** 0 = Sunday, as the backend spells it. */
  weekdays: number[];
  start: string;
  end: string;
  breakStart: string | null;
  breakEnd: string | null;
  activityIds: string[];
}

/** `Po–Pá 08:00–18:00, přestávka 12:00–12:30, 8 činností, 1. 10. – 31. 10. 2026`. */
export function planPreview(draft: PlanDraft): string {
  const hasBreak = !!draft.breakStart && !!draft.breakEnd;
  return [
    `${weekdaysLabel(draft.weekdays)} ${draft.start}–${draft.end}`,
    ...(hasBreak ? [`přestávka ${draft.breakStart}–${draft.breakEnd}`] : []),
    activitiesCount(draft.activityIds.length),
    formatRange(draft.range),
  ].join(', ');
}

/** What stops the plan from being saved, in words for the person at the screen. */
export function planProblems(draft: PlanDraft): string[] {
  const problems: string[] = [];
  if (draft.weekdays.length === 0) problems.push('Vyberte aspoň jeden pracovní den.');

  const shift = shiftProblem({
    working: true,
    start: draft.start,
    end: draft.end,
    breakStart: draft.breakStart,
    breakEnd: draft.breakEnd,
    workerUserId: null,
  });
  if (shift) problems.push(shift);

  if (draft.activityIds.length === 0) {
    problems.push('Vyberte aspoň jednu činnost - bez činnosti se do kalendáře nedá objednat.');
  }
  return problems;
}

/* ── Payloads ── */

export function periodInput(draft: PlanDraft): SchedulePeriodInput {
  return { name: planName(draft.range), validFrom: draft.range.from, validTo: draft.range.to };
}

/** One every-week row per chosen weekday, Monday first. */
export function workingHourInputs(draft: PlanDraft): WorkingHourInput[] {
  return WEEK_DAYS.filter((day) => draft.weekdays.includes(day)).map((dayOfWeek) => ({
    dayOfWeek,
    startTime: draft.start,
    endTime: draft.end,
    breakStart: draft.breakStart || null,
    breakEnd: draft.breakEnd || null,
    repeatEveryNWeeks: 1,
    weekOffset: 0,
    workerUserId: null,
    isActive: true,
  }));
}

/**
 * The whole grid, every weekday sent: saving is a full replacement, and a day
 * left out would be stored as "offers nothing".
 */
export function dayActivityRows(draft: PlanDraft): DayActivityRow[] {
  return WEEK_DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    activityIds: draft.weekdays.includes(dayOfWeek) ? [...draft.activityIds] : [],
  }));
}

export interface DayDraft {
  date: DateOnly;
  works: boolean;
  start: string;
  end: string;
  reason: string;
}

export function dayProblems(day: DayDraft): string[] {
  if (!day.works) return [];
  const shift = shiftProblem({
    working: true,
    start: day.start,
    end: day.end,
    breakStart: null,
    breakEnd: null,
    workerUserId: null,
  });
  return shift ? [shift] : [];
}

/** A single date is the existing exception: closed, or other hours. */
export function dayException(day: DayDraft): ScheduleExceptionInput {
  return {
    date: day.date,
    isClosed: !day.works,
    startTime: day.works ? day.start : null,
    endTime: day.works ? day.end : null,
    workerUserId: null,
    reason: day.reason.trim(),
    isClosedToPublic: false,
  };
}

export function dayPreview(day: DayDraft): string {
  const name = LONG_DAY[dayOfWeekOf(day.date)];
  return day.works
    ? `${name} ${formatDateOnly(day.date)}: ${day.start}–${day.end}`
    : `${name} ${formatDateOnly(day.date)}: zavřeno`;
}

/* ── How the plan meets the periods that already exist ── */

export type ConflictKind = 'split' | 'trimEnd' | 'trimStart' | 'replace';

export interface PeriodConflict {
  period: SchedulePeriod;
  kind: ConflictKind;
  /** What is left of the old period before the plan; null when it starts inside the plan. */
  head: DateRange | null;
  /** What is left after the plan; null when it ends inside the plan. */
  tail: { from: DateOnly; to: DateOnly | null } | null;
}

/**
 * Same test as the server's `SchedulePeriod.OverlapsWith`: an open end
 * overlaps everything after its start.
 */
export function findConflicts(periods: readonly SchedulePeriod[], range: DateRange): PeriodConflict[] {
  return [...periods]
    .filter(
      (period) =>
        period.validFrom <= range.to && (period.validTo === null || period.validTo >= range.from),
    )
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
    .map((period): PeriodConflict => {
      const head =
        period.validFrom < range.from
          ? { from: period.validFrom, to: addDaysToDateOnly(range.from, -1) }
          : null;
      const tail =
        period.validTo === null || period.validTo > range.to
          ? { from: addDaysToDateOnly(range.to, 1), to: period.validTo }
          : null;
      const kind: ConflictKind =
        head && tail ? 'split' : head ? 'trimEnd' : tail ? 'trimStart' : 'replace';
      return { period, kind, head, tail };
    });
}

const span = (from: DateOnly, to: DateOnly | null): string =>
  to === null ? `od ${formatDateOnly(from)}, bez konce` : formatRange({ from, to });

/** The honest sentence about what saving does to an existing period. */
export function describeConflict(conflict: PeriodConflict): string {
  const { period, kind, head, tail } = conflict;
  const was = `„${period.name}“ (${span(period.validFrom, period.validTo)})`;
  switch (kind) {
    case 'split':
      return `Období ${was} se rozdělí: bude platit jen do ${formatDateOnly(head?.to)} a od ${formatDateOnly(tail?.from)} se vrátí jeho původní otevírací doba i činnosti. Mezi tím platí nový plán.`;
    case 'trimEnd':
      return `Období ${was} se zkrátí: bude platit jen do ${formatDateOnly(head?.to)}. Od ${formatDateOnly(head ? addDaysToDateOnly(head.to, 1) : null)} platí nový plán.`;
    case 'trimStart':
      return `Období ${was} se zkrátí: začne platit až od ${formatDateOnly(tail?.from)}. Do té doby platí nový plán.`;
    case 'replace':
      return `Období ${was} leží celé uvnitř plánu a nový plán ho nahradí. Jeho otevírací doba a činnosti v těchto dnech přestanou platit.`;
  }
}

/* ── The operations ── */

type PeriodKey = 'plan' | `tail:${string}`;
type PeriodRef = { key: PeriodKey } | { id: string };

export type PlanOp =
  | { kind: 'deletePeriod'; periodId: string }
  | { kind: 'updatePeriod'; periodId: string; input: SchedulePeriodInput; token: string | null }
  | { kind: 'deleteWorkingHour'; id: string }
  | { kind: 'createPeriod'; key: PeriodKey; input: SchedulePeriodInput }
  | { kind: 'createWorkingHour'; periodRef: PeriodRef; input: WorkingHourInput }
  | { kind: 'saveDayActivities'; periodRef: PeriodRef; rows: DayActivityRow[] };

/** What has to be known about a covering period before it can be cut. */
export interface CoveringContext {
  conflict: PeriodConflict;
  /** Needed for `split` and `trimStart`: what the surviving part must keep. */
  rows: WorkingHour[];
  grid: DayActivityRow[];
  /** The impact report's acknowledgement for the cut, or null when nobody is affected. */
  token: string | null;
}

const dayNumber = (date: DateOnly): number => Math.round(parseDateOnly(date).getTime() / 86_400_000);

/**
 * A row's week offset after its period starts on another date.
 *
 * The server counts "week A" from the Monday on or before the period's start,
 * so moving the start by whole weeks turns A into B unless the offset moves
 * with it (4.2, `WeekCycle.Covers`). A plain every-week row never changes.
 */
export function shiftedOffset(
  row: { repeatEveryNWeeks: number; weekOffset: number },
  oldStart: DateOnly,
  newStart: DateOnly,
): number {
  const n = row.repeatEveryNWeeks;
  if (n <= 1) return 0;
  const weeks = Math.round((dayNumber(mondayOf(newStart)) - dayNumber(mondayOf(oldStart))) / 7);
  return (((row.weekOffset - weeks) % n) + n) % n;
}

const hhmm = (time: string | null): string | null => (time ? time.slice(0, 5) : null);

const copyRow = (row: WorkingHour, weekOffset: number): WorkingHourInput => ({
  dayOfWeek: row.dayOfWeek,
  startTime: hhmm(row.startTime) as string,
  endTime: hhmm(row.endTime) as string,
  breakStart: hhmm(row.breakStart),
  breakEnd: hhmm(row.breakEnd),
  repeatEveryNWeeks: row.repeatEveryNWeeks,
  weekOffset,
  workerUserId: row.workerUserId,
  isActive: true,
});

/**
 * The ordered steps that turn "plan over an existing timetable" into stored
 * rows. Order matters because periods may not overlap even for a moment:
 * the old period is cut or removed first, the plan goes in, and the surviving
 * tail of a split is created last.
 */
export function planOperations(draft: PlanDraft, contexts: readonly CoveringContext[]): PlanOp[] {
  const ops: PlanOp[] = [];
  const after: PlanOp[] = [];

  for (const { conflict, rows, grid, token } of contexts) {
    const { period, kind, head, tail } = conflict;

    if (kind === 'replace') {
      ops.push({ kind: 'deletePeriod', periodId: period.id });
      continue;
    }

    if ((kind === 'split' || kind === 'trimEnd') && head) {
      ops.push({
        kind: 'updatePeriod',
        periodId: period.id,
        input: { name: period.name, validFrom: head.from, validTo: head.to },
        token,
      });
    }

    if (kind === 'split' && tail) {
      const key: PeriodKey = `tail:${period.id}`;
      after.push({
        kind: 'createPeriod',
        key,
        input: { name: period.name, validFrom: tail.from, validTo: tail.to },
      });
      for (const row of rows) {
        after.push({
          kind: 'createWorkingHour',
          periodRef: { key },
          input: copyRow(row, shiftedOffset(row, period.validFrom, tail.from)),
        });
      }
      if (grid.some((day) => day.activityIds.length > 0)) {
        after.push({ kind: 'saveDayActivities', periodRef: { key }, rows: grid });
      }
    }

    if (kind === 'trimStart' && tail) {
      ops.push({
        kind: 'updatePeriod',
        periodId: period.id,
        input: { name: period.name, validFrom: tail.from, validTo: tail.to },
        token,
      });
      /*
       * Rows whose cycle would flip are deleted and re-created instead of
       * updated: swapping A and B in place would put two rows on the same
       * day at once, and the server refuses that.
       */
      for (const row of rows) {
        const offset = shiftedOffset(row, period.validFrom, tail.from);
        if (offset === row.weekOffset) continue;
        ops.push({ kind: 'deleteWorkingHour', id: row.id });
        after.push({ kind: 'createWorkingHour', periodRef: { id: period.id }, input: copyRow(row, offset) });
      }
    }
  }

  ops.push({ kind: 'createPeriod', key: 'plan', input: periodInput(draft) });
  for (const input of workingHourInputs(draft)) {
    ops.push({ kind: 'createWorkingHour', periodRef: { key: 'plan' }, input });
  }
  ops.push({ kind: 'saveDayActivities', periodRef: { key: 'plan' }, rows: dayActivityRows(draft) });

  return [...ops, ...after];
}

/** The slice of `workingHoursApi` the plan needs - small on purpose, so tests can fake it. */
export interface PlanApi {
  createPeriod(calendarId: string, input: SchedulePeriodInput): Promise<{ id: string }>;
  updatePeriod(
    calendarId: string,
    periodId: string,
    input: SchedulePeriodInput,
    token?: string,
  ): Promise<unknown>;
  deletePeriod(calendarId: string, periodId: string): Promise<void>;
  createWorkingHour(calendarId: string, periodId: string, input: WorkingHourInput): Promise<unknown>;
  deleteWorkingHour(calendarId: string, id: string): Promise<void>;
  saveDayActivities(calendarId: string, periodId: string, rows: DayActivityRow[]): Promise<unknown>;
}

/** Runs the steps in order and stops at the first failure. Returns the new plan period's id. */
export async function runPlanOperations(
  api: PlanApi,
  calendarId: string,
  ops: readonly PlanOp[],
): Promise<string> {
  const created = new Map<string, string>();
  const resolve = (ref: PeriodRef): string =>
    'id' in ref ? ref.id : (created.get(ref.key) as string);

  for (const op of ops) {
    switch (op.kind) {
      case 'deletePeriod':
        await api.deletePeriod(calendarId, op.periodId);
        break;
      case 'updatePeriod':
        await api.updatePeriod(calendarId, op.periodId, op.input, op.token ?? undefined);
        break;
      case 'deleteWorkingHour':
        await api.deleteWorkingHour(calendarId, op.id);
        break;
      case 'createPeriod':
        created.set(op.key, (await api.createPeriod(calendarId, op.input)).id);
        break;
      case 'createWorkingHour':
        await api.createWorkingHour(calendarId, resolve(op.periodRef), op.input);
        break;
      case 'saveDayActivities':
        await api.saveDayActivities(calendarId, resolve(op.periodRef), op.rows);
        break;
    }
  }

  return created.get('plan') as string;
}

/* ── Who ends up outside the plan ── */

type Booked = Pick<DayAppointment, 'id' | 'startUtc' | 'endUtc' | 'status' | 'activityId'>;

/** 0 Scheduled, 1 Confirmed, 2 CheckedIn - the ones that still need a slot. */
const isStillBooked = (appointment: Booked): boolean => appointment.status <= 2;

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** The appointment's Prague date, start and end as minutes in its day; an end past midnight counts as 24:00. */
function minutesOf(appointment: Booked): { date: DateOnly; start: number; end: number } {
  const date = pragueDateKey(appointment.startUtc);
  const start = toMinutes(formatPragueTime(appointment.startUtc));
  const end =
    pragueDateKey(appointment.endUtc) === date ? toMinutes(formatPragueTime(appointment.endUtc)) : 24 * 60;
  return { date, start, end };
}

/** Booked appointments inside the range that the new plan no longer offers. */
export function appointmentsOutsidePlan<T extends Booked>(appointments: readonly T[], draft: PlanDraft): T[] {
  const hasBreak = !!draft.breakStart && !!draft.breakEnd;
  return appointments.filter((appointment) => {
    if (!isStillBooked(appointment)) return false;
    const { date, start, end } = minutesOf(appointment);
    if (date < draft.range.from || date > draft.range.to) return false;
    if (!draft.weekdays.includes(dayOfWeekOf(date))) return true;
    if (!draft.activityIds.includes(appointment.activityId)) return true;
    if (start < toMinutes(draft.start) || end > toMinutes(draft.end)) return true;
    return (
      hasBreak && start < toMinutes(draft.breakEnd as string) && end > toMinutes(draft.breakStart as string)
    );
  });
}

/** The same question for a single date saved as an exception. */
export function appointmentsOutsideDay<T extends Booked>(appointments: readonly T[], day: DayDraft): T[] {
  return appointments.filter((appointment) => {
    if (!isStillBooked(appointment)) return false;
    const { date, start, end } = minutesOf(appointment);
    if (date !== day.date) return false;
    if (!day.works) return true;
    return start < toMinutes(day.start) || end > toMinutes(day.end);
  });
}

/** Windows of at most 62 days, the longest range the day endpoint accepts. */
export function chunkRange({ from, to }: DateRange, days = 62): DateRange[] {
  const chunks: DateRange[] = [];
  let cursor = from;
  while (cursor <= to) {
    const end = addDaysToDateOnly(cursor, days - 1);
    chunks.push({ from: cursor, to: end < to ? end : to });
    cursor = addDaysToDateOnly(cursor, days);
  }
  return chunks;
}
