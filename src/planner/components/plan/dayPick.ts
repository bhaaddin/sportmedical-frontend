/*
 * Picking whole days in the month for a club order - the pure half (`useDayPick` is the other).
 *
 * A pick is "these days, for the armed činnost (or, with none armed, for every činnost that still lacks players, one
 * after another)". For every day the free time is what the clinic really offers: the opening hours without the lunch
 * break and without every term already on the board (`freeBlocksOfPlannerDay`); whole slots are taken from it by the
 * same rule "Přidat další den" uses (`takeForActivity`), never more than the players still missing, the rest of the
 * day stays free for ordinary bookings. Days are walked in order and the walk STOPS the moment every činnost asked
 * for has its players; a day that cannot be taken (past, closed, no hours, no room, need met) is reported with its
 * reason, so a click never does nothing.
 *
 * Pure: no React, no network.
 */
import { minutesAsTime, type DayMark, type IntervalInput, type IsoDate, type PlannerSession } from '../../model';
import { takeForActivity } from '../../../components/booking/calendar/pickPlan';
import { freeBlocksOfPlannerDay } from './addDay';
import { formatShortDate } from './dayLabels';
import { PLAN_STEP, type OrderFigures } from './orderFigures';

export interface DayRangeLike {
  from: IsoDate;
  to: IsoDate;
}

const addDay = (date: IsoDate): IsoDate => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** The days of the ranges, ascending, each once. */
export function expandRanges(ranges: readonly DayRangeLike[]): IsoDate[] {
  const out = new Set<IsoDate>();
  for (const r of ranges) {
    for (let d = r.from; d <= r.to && out.size < 400; d = addDay(d)) out.add(d);
  }
  return [...out].sort();
}

export interface PickedRun {
  date: IsoDate;
  categoryId: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  slots: number;
  /** Players the run covers (never more than were missing). */
  seats: number;
}

export interface DaySkip {
  date: IsoDate;
  reason: string;
}

export interface DayPickPlan {
  parts: PickedRun[];
  /** What `createInterval` takes, one per run. */
  inputs: IntervalInput[];
  skipped: DaySkip[];
  daysUsed: IsoDate[];
  slotsBy: Map<string, number>;
  seatsBy: Map<string, number>;
  /** The last run (or day) was cut short because the need ended there. */
  limited: boolean;
  /** There was nothing to plan at all: every činnost asked for already has its players. */
  fulfilled: boolean;
}

export interface DayPickInput {
  dates: readonly IsoDate[];
  figures: OrderFigures;
  /** The armed činnost; null = every činnost that still lacks players, in the order's order. */
  armed: string | null;
  marks: Readonly<Record<IsoDate, DayMark>>;
  /** Everything on the board (terms of the order and of everybody else), for the free time of each day. */
  sessions: readonly PlannerSession[];
  today: IsoDate;
}

const NEED_MET = 'Potřeba klubu je už naplněna.';

export function planDays(input: DayPickInput): DayPickPlan {
  const { figures } = input;
  const wanted = (input.armed ? figures.list.filter((f) => f.categoryId === input.armed) : figures.list).filter((f) => f.requested > 0);
  const left = new Map(wanted.map((f) => [f.categoryId, f.remaining] as const));
  const plan: DayPickPlan = { parts: [], inputs: [], skipped: [], daysUsed: [], slotsBy: new Map(), seatsBy: new Map(), limited: false, fulfilled: false };
  const open = () => wanted.filter((f) => (left.get(f.categoryId) ?? 0) > 0);
  if (open().length === 0) {
    plan.fulfilled = true;
    plan.skipped = input.dates.map((date) => ({ date, reason: NEED_MET }));
    return plan;
  }
  const taken: PlannerSession[] = [];
  for (const date of [...input.dates].sort()) {
    if (open().length === 0) {
      plan.skipped.push({ date, reason: NEED_MET });
      continue;
    }
    if (date < input.today) {
      plan.skipped.push({ date, reason: 'Den je v minulosti.' });
      continue;
    }
    const mark = input.marks[date];
    if (mark?.closed) {
      plan.skipped.push({ date, reason: `V tento den je zavřeno${mark.label ? ` (${mark.label})` : ''}.` });
      continue;
    }
    if (!mark || !mark.hours) {
      plan.skipped.push({ date, reason: 'Ordinace v tento den nemá ordinační dobu.' });
      continue;
    }
    let tookSomething = false;
    for (const f of open()) {
      const remaining = left.get(f.categoryId) ?? 0;
      const blocks = freeBlocksOfPlannerDay(mark, [...input.sessions, ...taken], date);
      if (blocks.length === 0) break;
      const take = takeForActivity(blocks, { minutesPerSeat: f.slotMinutes, parallelCapacity: f.lanes }, remaining, PLAN_STEP);
      let seatsLeft = remaining;
      for (const b of take.blocks) {
        const slots = Math.floor((b.range.end - b.range.start) / f.slotMinutes + 1e-9);
        if (slots <= 0) continue;
        const seats = Math.min(seatsLeft, slots * f.lanes);
        seatsLeft -= seats;
        const end = b.range.start + slots * f.slotMinutes;
        plan.parts.push({ date, categoryId: f.categoryId, start: b.range.start, end, slots, seats });
        plan.inputs.push({ date, categoryId: f.categoryId, start: minutesAsTime(b.range.start), quantity: slots });
        plan.slotsBy.set(f.categoryId, (plan.slotsBy.get(f.categoryId) ?? 0) + slots);
        plan.seatsBy.set(f.categoryId, (plan.seatsBy.get(f.categoryId) ?? 0) + seats);
        taken.push({ id: `pick-${taken.length}`, date, start: minutesAsTime(b.range.start), end: minutesAsTime(end), categoryId: f.categoryId, capacity: slots, booked: 0 });
        tookSomething = true;
      }
      left.set(f.categoryId, seatsLeft);
      /* This činnost's need ended inside the day: the rest of the day stays free (for the next činnost, or for patients). */
      if (seatsLeft === 0 && take.trimmed) plan.limited = true;
    }
    if (tookSomething) plan.daysUsed.push(date);
    else plan.skipped.push({ date, reason: 'V tento den není volný čas na celý slot.' });
  }
  return plan;
}

const slotsWord = (n: number): string => (n === 1 ? 'slot' : n >= 2 && n <= 4 ? 'sloty' : 'slotů');
const daysWord = (n: number): string => (n === 1 ? '1 den' : n >= 2 && n <= 4 ? `${n} dny` : `${n} dnů`);

/** The sentence the desk reads after a pick: what was taken and, for every day that was not, why. */
export function describeDayPick(plan: DayPickPlan, names: ReadonlyMap<string, string> = new Map()): { text: string; tone: 'ok' | 'info' | 'refused' } {
  if (plan.parts.length === 0) {
    if (plan.fulfilled) return { text: 'Všechny požadované osoby už mají termín - víc klub nepotřebuje.', tone: 'refused' };
    const why = plan.skipped.slice(0, 2).map((s) => `${formatShortDate(s.date)} ${s.reason.charAt(0).toLowerCase()}${s.reason.slice(1)}`).join(' ');
    return { text: why === '' ? 'Nic nebylo naplánováno.' : `Nic nebylo naplánováno. ${why}`, tone: 'refused' };
  }
  const total = [...plan.slotsBy.values()].reduce((n, v) => n + v, 0);
  const per = [...plan.slotsBy.entries()].map(([id, n]) => `${names.get(id) ?? id} ${n}`).join(', ');
  const parts = [`Naplánováno ${daysWord(plan.daysUsed.length)}: ${total} ${slotsWord(total)}${plan.slotsBy.size > 1 ? ` (${per})` : ''}.`];
  if (plan.limited) parts.push('Poslední den je vzat jen část - víc klub nepotřebuje.');
  if (plan.skipped.length > 0) {
    const shown = plan.skipped.slice(0, 3).map((s) => `${formatShortDate(s.date)} ${s.reason.charAt(0).toLowerCase()}${s.reason.slice(1)}`);
    parts.push(`Nevzato: ${shown.join(' ')}${plan.skipped.length > 3 ? ` … a ${plan.skipped.length - 3} dalších` : ''}`);
  }
  return { text: parts.join(' '), tone: plan.skipped.length > 0 || plan.limited ? 'info' : 'ok' };
}
