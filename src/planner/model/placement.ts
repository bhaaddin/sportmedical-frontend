/*
 * Dragging a činnost into the calendar.
 *
 * Port of `pointerCoords`, `selectionFromPointer`, the pointer-down branch of
 * the board (`beginPlacement`), `validatePlacement`, `makeSlots`,
 * `samePlanningResource`, `canSafelyMerge`, `collectAdjacentBlocks` and
 * `addPlannedInterval`.
 *
 * All of it is pure: the functions take the sessions through the context and
 * return new data. The UI owns the pointer events and the timers; it feeds the
 * pointer in as FRACTIONS of the board (0..1) so the CSS scale of the stage
 * cannot matter (see `components/PlannerStage.tsx` for `pointerCoords`).
 */
import { demandOf, slotMinutesOf } from './context';
import { plannedFrom, plannedOf } from './order';
import { addDays, clamp, minutesAsTime, timeAsMinutes } from './time';
import type {
  AddIntervalResult,
  BoardPoint,
  CategoryId,
  IntervalInput,
  IsoDate,
  MergeResult,
  PlacementDrag,
  PlacementPreview,
  PlannerContext,
  PlannerSession,
  PlannerSlot,
  Validation,
} from './types';

/** Snap of the pointer to the clock, in minutes. */
export const SNAP_MINUTES = 5;

const win = (ctx: Pick<PlannerContext, 'window'>) => ({
  start: ctx.window.startMinutes,
  end: ctx.window.endMinutes,
  span: ctx.window.endMinutes - ctx.window.startMinutes,
});

/** "07:00–19:00" for the validation texts. */
export const windowLabel = (ctx: Pick<PlannerContext, 'window'>): string =>
  `${minutesAsTime(ctx.window.startMinutes)}–${minutesAsTime(ctx.window.endMinutes)}`;

/**
 * Pointer -> fractions of the board (`pointerCoords`).
 * `rect` is `board.getBoundingClientRect()`; because both numerator and
 * denominator are scaled equally by the stage, no scale correction is needed.
 */
export function pointerCoords(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): BoardPoint {
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 0.99999),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

/** Day index (0..6) of an ISO date inside a week, DST-safe. */
export function dayIndexInWeek(weekStart: IsoDate, date: IsoDate): number {
  const a = Date.UTC(+weekStart.slice(0, 4), +weekStart.slice(5, 7) - 1, +weekStart.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function makeSlots(start: string, quantity: number, duration: number): PlannerSlot[] {
  const a = timeAsMinutes(start);
  return Array.from({ length: quantity }, (_, i) => ({
    start: minutesAsTime(a + i * duration),
    end: minutesAsTime(a + (i + 1) * duration),
  }));
}

/* ------------------------------ validation ------------------------------ */

export function validatePlacement(
  ctx: PlannerContext,
  p: { date: IsoDate; categoryId: CategoryId | null; start: string; end: string; quantity: number; skipId?: string; allowExtra?: boolean },
): Validation {
  const { date, categoryId, start, end, quantity, skipId } = p;
  const demand = categoryId ? demandOf(ctx, categoryId) : undefined;
  if (!categoryId || !demand) return { ok: false, reason: 'Vyberte činnost' };
  if (!/\d{4}-\d\d-\d\d/.test(date)) return { ok: false, reason: 'Chybné datum' };
  const st = timeAsMinutes(start);
  const en = timeAsMinutes(end);
  const w = win(ctx);
  if (!Number.isFinite(st) || !Number.isFinite(en) || st < w.start || en > w.end || st >= en) {
    return { ok: false, reason: `Čas musí být v intervalu ${windowLabel(ctx)}` };
  }
  if (quantity <= 0 || !Number.isInteger(quantity)) return { ok: false, reason: 'Neplatný počet slotů' };
  const others = ctx.sessions.filter((e) => e.id !== skipId);
  const baseline = plannedFrom(ctx, others, categoryId);
  const remain = demand.requested - baseline;
  if (quantity > remain && !p.allowExtra) return { ok: false, reason: `Zbývá pouze ${remain} osob. Zkraťte časový úsek.` };
  const sameDay = others.filter((e) => e.date === date);
  if (sameDay.some((e) => st < timeAsMinutes(e.end) && en > timeAsMinutes(e.start))) {
    return { ok: false, reason: 'Čas se překrývá s již vytvořeným termínem.' };
  }
  return { ok: true, reason: '' };
}

/* ------------------------------ drag ------------------------------ */

export type PlacementStart =
  | { kind: 'noSelection' }
  | { kind: 'complete'; categoryId: CategoryId }
  | { kind: 'start'; drag: PlacementDrag };

/**
 * Pointer down on the empty board (`board.pointerdown`): nothing selected ->
 * hint, selected činnost already complete -> completion callout, otherwise the
 * drag anchor (day column + the minute, aligned so one slot still fits).
 */
export function beginPlacement(ctx: PlannerContext, selected: CategoryId | null, point: BoardPoint): PlacementStart {
  if (!selected) return { kind: 'noSelection' };
  const d = demandOf(ctx, selected);
  if (d && plannedOf(ctx, selected) >= d.requested) return { kind: 'complete', categoryId: selected };
  const w = win(ctx);
  const slot = slotMinutesOf(ctx, selected);
  const at = clamp(Math.round((w.start + point.y * w.span) / SNAP_MINUTES) * SNAP_MINUTES, w.start, w.end);
  const aligned = at > w.end - slot ? w.end - slot : at;
  return { kind: 'start', drag: { day: Math.floor(point.x * 7), startMinutes: aligned } };
}

/**
 * The interval a drag proposes (`selectionFromPointer`). Up or down from the
 * anchor, in whole slots, capped by what is still ordered and by the end of
 * the window. `null` = nothing to draw (complete činnost, no room for a slot).
 */
export function selectionFromPointer(
  ctx: PlannerContext,
  drag: PlacementDrag | null,
  categoryId: CategoryId | null,
  weekStart: IsoDate,
  point: BoardPoint,
): PlacementPreview | null {
  if (!drag || !categoryId) return null;
  const demand = demandOf(ctx, categoryId);
  if (!demand) return null;
  const duration = slotMinutesOf(ctx, categoryId);
  const remaining = Math.max(0, demand.requested - plannedOf(ctx, categoryId));
  if (remaining === 0) return null; // hard stop, not an invalid/red interval
  const w = win(ctx);
  const anchor = drag.startMinutes;
  const pointer = clamp(Math.round((w.start + point.y * w.span) / SNAP_MINUTES) * SNAP_MINUTES, w.start, w.end);
  const upwards = pointer < anchor;
  const maxByTime = upwards ? Math.floor((anchor - w.start) / duration) : Math.floor((w.end - anchor) / duration);
  const rawQty = Math.max(1, Math.ceil((upwards ? anchor - pointer : pointer - anchor) / duration));
  const quantity = Math.min(rawQty, remaining, maxByTime);
  if (quantity < 1) return null;
  const startMinutes = upwards ? anchor - quantity * duration : anchor;
  const endMinutes = startMinutes + quantity * duration;
  const date = addDays(weekStart, drag.day);
  const start = minutesAsTime(startMinutes);
  const end = minutesAsTime(endMinutes);
  const validation = validatePlacement(ctx, { date, categoryId, start, end, quantity });
  return {
    kind: 'place',
    date,
    categoryId,
    start,
    end,
    quantity,
    validation,
    col: drag.day,
    startMinutes,
    endMinutes,
    isLimit: quantity === remaining,
    stoppedAtLimit: rawQty > remaining && remaining <= maxByTime,
    blockedByEndOfDay: rawQty > maxByTime,
    remaining,
  };
}

/* ------------------------------ merging ------------------------------ */

/** Two terms are the same planning resource when none of these differ. */
export function samePlanningResource(a: PlannerSession, b: PlannerSession): boolean {
  const keys = ['clubId', 'orderId', 'staffId', 'roomId', 'equipmentId'] as const;
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

/**
 * May `e` be merged into `withTerm`? Only planner-made blocks of the same day
 * and činnost, with no registrations, the same slot length, consistent length
 * and the same planning resource. Never silently reschedules booked people.
 */
export function canSafelyMerge(ctx: PlannerContext, e: PlannerSession, withTerm: PlannerSession): boolean {
  const duration = slotMinutesOf(ctx, withTerm.categoryId);
  const oldLength = timeAsMinutes(e.end) - timeAsMinutes(e.start);
  return (
    e.createdByPlanner === true &&
    e.date === withTerm.date &&
    e.categoryId === withTerm.categoryId &&
    Number(e.booked || 0) === 0 &&
    !(e.slots || []).some((slot) => slot.bookingId || slot.participantId) &&
    Number(e.slotDuration || duration) === duration &&
    oldLength === Number(e.capacity) * duration &&
    samePlanningResource(e, withTerm)
  );
}

/** Includes the bridge case: A 09–10 and B 11–12 + new 10–11 => one 09–12 term. */
export function collectAdjacentBlocks(
  ctx: PlannerContext,
  term: PlannerSession,
  sessions: readonly PlannerSession[] = ctx.sessions,
): MergeResult {
  let from = term.start;
  let to = term.end;
  const group: PlannerSession[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of sessions) {
      if (group.includes(e) || !canSafelyMerge(ctx, e, term)) continue;
      if (e.end === from || e.start === to) {
        group.push(e);
        if (e.end === from) from = e.start;
        if (e.start === to) to = e.end;
        changed = true;
      }
    }
  }
  return { group, start: from, end: to };
}

let idCounter = 0;
/** `plan-<time>-<random>` like the prototype; injectable for tests. */
export const defaultIdFactory = (): string => `plan-${Date.now()}-${Math.floor(Math.random() * 10000)}-${idCounter++}`;

/**
 * Drop-to-create (`addPlannedInterval`): validates, merges with every adjacent
 * safe block (keeping the oldest/leftmost id) and returns the new session list.
 * Does not mutate its input. `complete` tells the UI to leave planning mode
 * and show the completion callout.
 */
export function addPlannedInterval(
  ctx: PlannerContext,
  input: IntervalInput,
  newId: () => string = defaultIdFactory,
): AddIntervalResult {
  const { date, categoryId, start, quantity } = input;
  const d = demandOf(ctx, categoryId);
  const none = (reason: string): AddIntervalResult => ({
    ok: false, reason, sessions: [...ctx.sessions], merged: null, removedIds: [], mergedCount: 0, complete: false,
  });
  if (!d) return none('Vyberte činnost');
  const duration = slotMinutesOf(ctx, categoryId);
  const end = minutesAsTime(timeAsMinutes(start) + quantity * duration);
  const test = validatePlacement(ctx, { date, categoryId, start, end, quantity, allowExtra: input.allowExtra === true });
  if (!test.ok) return none(test.reason);
  const candidate: PlannerSession = {
    id: newId(), date, start, end, categoryId, capacity: quantity, booked: 0,
    showInList: true, createdByPlanner: true, slotDuration: duration,
  };
  const chain = collectAdjacentBlocks(ctx, candidate);
  const total = quantity + chain.group.reduce((n, e) => n + Number(e.capacity), 0);
  // Preserve the oldest/leftmost term ID. Only unbooked blocks may merge.
  const first = chain.group.slice().sort((a, b) => a.start.localeCompare(b.start))[0];
  const merged: PlannerSession = {
    ...(first ?? candidate),
    start: chain.start,
    end: chain.end,
    capacity: total,
    booked: 0,
    slots: makeSlots(chain.start, total, duration),
    slotDuration: duration,
    createdByPlanner: true,
  };
  const removeIds = new Set(chain.group.map((x) => x.id));
  const sessions = ctx.sessions.filter((e) => !removeIds.has(e.id));
  sessions.push(merged);
  const complete = plannedFrom(ctx, sessions, categoryId) >= d.requested;
  return {
    ok: true, reason: '', sessions, merged, removedIds: [...removeIds],
    mergedCount: chain.group.length, complete,
  };
}

/** Toast text after a successful drop (`showPlanToast`). */
export function planToastCaption(n: number, categoryName: string, mergedCount: number): string {
  return mergedCount > 1
    ? `✓ Spojeno ${mergedCount + 1} bloků do jednoho termínu`
    : mergedCount === 1
      ? `✓ Přidáno ${n} slotů · spojeno s existujícím termínem`
      : `✓ Přidáno ${n} slotů pro ${categoryName}`;
}

export interface CompletionCalloutModel {
  wholeOrder: boolean;
  eyebrow: string;
  title: string;
  categoryName: string;
  tone: string;
  stat: string;
  statCaption: string;
  line: string;
  /** "Prohlédnout plán" and "Jiná činnost" / "Zavřít" */
  anotherLabel: string;
  /** Next ordered činnost that is not complete yet, null when none. */
  nextCategoryId: CategoryId | null;
}

/** `showCompletionCallout` as data. `nextCategoryId` follows the order's display order. */
export function completionCalloutModel(
  ctx: PlannerContext,
  categoryId: CategoryId,
  totalsPending: number,
  categoryName: string,
  tone: string,
): CompletionCalloutModel {
  const d = demandOf(ctx, categoryId);
  const wholeOrder = totalsPending === 0;
  const next = ctx.demands.find((x) => x.categoryId !== categoryId && plannedOf(ctx, x.categoryId) < x.requested);
  return {
    wholeOrder,
    eyebrow: wholeOrder ? 'OBJEDNÁVKA DOKONČENA' : 'KAPACITA SPLNĚNA',
    title: wholeOrder ? 'Celá objednávka naplánována' : 'Požadavek naplněn',
    categoryName,
    tone,
    stat: `${plannedOf(ctx, categoryId)} / ${d?.requested ?? 0} osob`,
    statCaption: '100 % naplánováno',
    line: wholeOrder ? 'Všechny činnosti v objednávce jsou naplánované.' : 'Další sloty pro tuto činnost již nelze přidávat.',
    anotherLabel: wholeOrder ? 'Zavřít' : 'Jiná činnost',
    nextCategoryId: next?.categoryId ?? null,
  };
}

/** True when the činnost may be selected for planning (`selectPlanningType` guard). */
export function canSelectForPlanning(ctx: PlannerContext, categoryId: CategoryId): 'ok' | 'unknown' | 'complete' {
  const d = demandOf(ctx, categoryId);
  if (!d) return 'unknown';
  return plannedOf(ctx, categoryId) >= d.requested ? 'complete' : 'ok';
}

