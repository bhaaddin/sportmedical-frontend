/*
 * Dragging a činnost into the calendar, counted like the club order is counted.
 *
 * The geometry (pointer -> day column, snap to 5 minutes, up or down from the anchor, whole slots, capped by the
 * end of the window) is the prototype's `selectionFromPointer` and is the same here; what is different is how
 * MANY slots may still be dropped: the model counts one pool of players, the order counts per činnost, so the
 * cap is the činnost's remaining WHOLE SLOTS (`ceil(remaining players / parallel capacity)`) from
 * `orderFigures`. With a parallel capacity of 1 both give the same answer (pinned in the tests).
 */
import {
  addDays,
  clamp,
  minutesAsTime,
  placementOverlay,
  SNAP_MINUTES,
  snapPointerMinute,
  timeAsMinutes,
  timeLeft,
  windowLabel,
  type BoardPoint,
  type DayMark,
  type IsoDate,
  type PlacementDrag,
  type PlacementOverlay,
  type PlacementPreview,
  type PlannerContext,
  type ResizePreview,
  type Validation,
} from '../../model';
import type { CategoryFigure, OrderFigures } from './orderFigures';

export type PlanStart =
  | { kind: 'noSelection' }
  | { kind: 'complete'; categoryId: string }
  | { kind: 'start'; drag: PlacementDrag };

const win = (ctx: Pick<PlannerContext, 'window'>) => ({
  start: ctx.window.startMinutes,
  end: ctx.window.endMinutes,
  span: ctx.window.endMinutes - ctx.window.startMinutes,
});

/** Pointer down on the empty board: nothing armed -> hint; armed činnost already complete -> callout; else the anchor. */
/** `extra`: the desk armed "Přidat termín navíc" - one more drop beyond the players is allowed. */
export function planStart(ctx: PlannerContext, figures: OrderFigures, selected: string | null, point: BoardPoint, extra = false, snap = SNAP_MINUTES): PlanStart {
  if (!selected) return { kind: 'noSelection' };
  const f = figures.byId.get(selected);
  if (!f) return { kind: 'noSelection' };
  if (f.done && !extra) return { kind: 'complete', categoryId: selected };
  const w = win(ctx);
  const at = clamp(snapPointerMinute(w.start + point.y * w.span, snap), w.start, w.end);
  const aligned = at > w.end - f.slotMinutes ? w.end - f.slotMinutes : at;
  return { kind: 'start', drag: { day: Math.floor(point.x * 7), startMinutes: aligned } };
}

/** The reasons the model's `validatePlacement` gives, counted per činnost in whole slots, plus the closed days. */
export function planValidation(
  ctx: PlannerContext,
  figures: OrderFigures,
  p: { date: IsoDate; categoryId: string | null; start: string; end: string; quantity: number },
  dayMarks: Readonly<Record<string, DayMark>> = {},
  extra = false,
): Validation {
  const f = p.categoryId ? figures.byId.get(p.categoryId) : undefined;
  if (!p.categoryId || !f) return { ok: false, reason: 'Vyberte činnost' };
  if (!/\d{4}-\d\d-\d\d/.test(p.date)) return { ok: false, reason: 'Chybné datum' };
  const st = timeAsMinutes(p.start);
  const en = timeAsMinutes(p.end);
  const w = win(ctx);
  if (!Number.isFinite(st) || !Number.isFinite(en) || st < w.start || en > w.end || st >= en) {
    return { ok: false, reason: `Čas musí být v intervalu ${windowLabel(ctx)}` };
  }
  if (p.quantity <= 0 || !Number.isInteger(p.quantity)) return { ok: false, reason: 'Neplatný počet slotů' };
  const mark = dayMarks[p.date];
  if (mark?.closed) return { ok: false, reason: `V tento den je zavřeno${mark.label ? ` (${mark.label})` : ''}.` };
  if (!extra && p.quantity > f.remainingSlots) return { ok: false, reason: `Zbývá pouze ${f.remaining} osob. Zkraťte časový úsek.` };
  if (ctx.sessions.some((e) => e.date === p.date && st < timeAsMinutes(e.end) && en > timeAsMinutes(e.start))) {
    return { ok: false, reason: 'Čas se překrývá s již vytvořeným termínem.' };
  }
  return { ok: true, reason: '' };
}

/**
 * The interval a drag proposes. Up or down from the anchor, in whole slots, capped by the činnost's remaining
 * slots and by the end of the window. `null` = nothing to draw (complete činnost, no room for a slot).
 * `PlacementPreview.quantity` is the number of SLOTS (what `createInterval` takes); `remaining` is the remaining slots.
 */
export function planSelection(
  ctx: PlannerContext,
  figures: OrderFigures,
  drag: PlacementDrag | null,
  categoryId: string | null,
  weekStart: IsoDate,
  point: BoardPoint,
  dayMarks: Readonly<Record<string, DayMark>> = {},
  extra = false,
  /** Minutes the pointer snaps to: the file's 5, or the visible grid line of a zoomed board. */
  snap = SNAP_MINUTES,
): PlacementPreview | null {
  if (!drag || !categoryId) return null;
  const f = figures.byId.get(categoryId);
  if (!f) return null;
  const duration = f.slotMinutes;
  if (!(duration > 0)) return null;
  /* The one extra drop is not capped by the players; it can be as long as the desk drags it. */
  const remaining = extra ? Number.MAX_SAFE_INTEGER : f.remainingSlots;
  if (remaining === 0) return null; // hard stop, not an invalid/red interval
  const w = win(ctx);
  const anchor = drag.startMinutes;
  const pointer = clamp(snapPointerMinute(w.start + point.y * w.span, snap), w.start, w.end);
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
  return {
    kind: 'place',
    date,
    categoryId,
    start,
    end,
    quantity,
    validation: planValidation(ctx, figures, { date, categoryId, start, end, quantity }, dayMarks, extra),
    col: drag.day,
    startMinutes,
    endMinutes,
    isLimit: !extra && quantity === remaining,
    stoppedAtLimit: !extra && rawQty > remaining && remaining <= maxByTime,
    blockedByEndOfDay: rawQty > maxByTime,
    remaining: extra ? 0 : remaining,
  };
}

/** Players one drop adds: slots × the činnost's parallel capacity, never more than are missing. */
export const seatsOf = (f: Pick<CategoryFigure, 'lanes' | 'remaining'>, slots: number): number => Math.min(f.remaining, slots * f.lanes);

/**
 * The preview + HUD of the drag with the figures of the order counted in (`added` players the window covers).
 * Geometry and texts of everything that is not a number are the model's `placementOverlay`.
 */
export function planOverlay(
  ctx: PlannerContext,
  p: PlacementPreview,
  f: CategoryFigure,
  added: number,
  boardWidth: number,
): PlacementOverlay {
  const o = placementOverlay(ctx, p, boardWidth);
  const valid = p.validation.ok;
  const after = Math.min(f.requested, f.planned + (valid ? added : 0));
  const progress = f.requested > 0 ? Math.round((after / f.requested) * 100) : 0;
  const left = Math.max(0, f.requested - after);
  return {
    preview: { ...o.preview, label: `+${p.quantity} ${p.quantity === 1 ? 'slot' : 'slotů'}` },
    hud: {
      ...o.hud,
      plus: `+${p.quantity}`,
      progress,
      numbersMain: `${after}`,
      numbersOf: `/ ${f.requested} osob`,
      status: !valid
        ? p.validation.reason
        : f.done
          ? 'Termín navíc nad rámec požadavku'
          : p.isLimit
            ? '✓ Tímto bude požadavek klubu naplněn'
            : `${timeLeft(p.quantity * f.slotMinutes)} · zbývá ${left} osob`,
    },
  };
}

/**
 * The model checks an edge pull against the players still missing in ONE pool; the order counts per činnost in
 * whole slots, so a pull that would add more slots than the činnost still needs is refused here as well.
 * Only ever tightens a valid proposal.
 */
export function guardResize(p: ResizePreview | null, figures: OrderFigures): ResizePreview | null {
  if (!p || !p.validation.ok || p.original.origin === 'public') return p;
  const f = figures.byId.get(p.categoryId);
  if (!f || p.added <= f.remainingSlots) return p;
  return { ...p, validation: { ok: false, reason: `V objednávce zbývá pouze ${f.remaining} míst pro tuto činnost.` } };
}
