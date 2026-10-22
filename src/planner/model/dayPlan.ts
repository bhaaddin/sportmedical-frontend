/*
 * Mini-calendar planning heat map.
 *
 * Port of `computeDayPlan`, `miniContent`, `renderMiniCell` (data part) and
 * `tooltipMarkup` (data part). The ring is a PLANNING view (planned minutes /
 * reference day capacity), not a reservation view: reservations are the
 * separate drill-down in `booking.ts`.
 */
import { groupByActivity, groupTitle, slotsText, spanText, countMark, type GroupEntryKind } from './activityGroups';
import { categoryOrFallback, dayEvents, minutesOf, sourceFor } from './context';
import { clockDuration, dateOf, printable, weekdayFull } from './time';
import type {
  CategoryId,
  DayPlan,
  DaySlice,
  IsoDate,
  MiniCellModel,
  PlanEntry,
  PlannerContext,
  PlannerSession,
  Preview,
  RingArc,
  LiquidLayer,
} from './types';

/** Ring radius used by the prototype's SVG (viewBox 48, r = 21). */
export const RING_RADIUS = 21;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** The most činnosti the liquid shows as their own band; the rest is one merged "další" band. */
export const LIQUID_MAX_LAYERS = 3;
export const LIQUID_OTHER_ID = '__other';
/** Neutral grey-blue of the merged band (never a činnost's colour). */
export const LIQUID_OTHER_COLOR = '#8795a3';

/**
 * The bands of a day's liquid: one per činnost of the day (the same grouping as the agenda, so a day with two Spiroergometrie
 * and two Komplexní bookings has two bands), height = the činnost's share of the day's slots, in the činnost's own `activityColor`.
 * At most `LIQUID_MAX_LAYERS` bands are shown - the largest ones, kept in the catalogue's order like the ring's arcs - and every
 * other činnost is merged into one grey "další" band on top. A day without slots (every window empty) weighs by minutes.
 */
export function liquidLayers(
  ctx: Pick<PlannerContext, 'categories'>,
  entries: readonly PlannerSession[],
  maxLayers: number = LIQUID_MAX_LAYERS,
): LiquidLayer[] {
  const groups = groupByActivity(ctx, entries);
  if (groups.length === 0) return [];
  const bySlots = groups.some((g) => g.slots > 0);
  const weightOf = (g: { slots: number; minutes: number }): number => (bySlots ? g.slots : g.minutes);
  const total = groups.reduce((n, g) => n + weightOf(g), 0);
  if (total <= 0) return [];
  const ranked = [...groups].sort((a, b) => weightOf(b) - weightOf(a));
  const kept = new Set(ranked.slice(0, Math.max(1, maxLayers)).map((g) => g.categoryId));
  const layers: LiquidLayer[] = groups
    .filter((g) => kept.has(g.categoryId) && weightOf(g) > 0)
    .map((g) => ({ categoryId: g.categoryId, color: g.tone, share: weightOf(g) / total, slots: g.slots, merged: false }));
  const rest = groups.filter((g) => !kept.has(g.categoryId));
  const restWeight = rest.reduce((n, g) => n + weightOf(g), 0);
  if (restWeight > 0) {
    layers.push({ categoryId: LIQUID_OTHER_ID, color: LIQUID_OTHER_COLOR, share: restWeight / total, slots: rest.reduce((n, g) => n + g.slots, 0), merged: true });
  }
  return layers;
}

const isProjectedExisting = (preview: Preview | null | undefined): preview is Extract<Preview, { kind: 'move' | 'resize' }> =>
  !!preview && (preview.kind === 'move' || preview.kind === 'resize') && !!preview.validation?.ok;

/**
 * The plan of one day: all terms of the day plus - when a valid `preview`
 * (placement drag, move or resize) lands on this day - the projected term.
 * A moved / resized term is removed from its old day and drawn on the new one.
 */
export function computeDayPlan(ctx: PlannerContext, date: IsoDate, preview?: Preview | null): DayPlan {
  const projectedExisting = isProjectedExisting(preview);
  const entries: PlanEntry[] = dayEvents(ctx, date)
    .filter((e) => !(projectedExisting && e.id === preview.eventId))
    .map((e) => ({ ...e, extraPreview: false }));

  if (projectedExisting && preview.date === date) {
    const existing = ctx.sessions.find((e) => e.id === preview.eventId);
    if (existing) {
      entries.push({
        ...existing,
        date: preview.date,
        start: preview.start,
        end: preview.end,
        capacity: preview.kind === 'resize' ? preview.capacity : existing.capacity,
        extraPreview: true,
      });
    }
  }
  if (
    preview &&
    preview.kind !== 'move' &&
    preview.kind !== 'resize' &&
    preview.date === date &&
    preview.validation?.ok &&
    preview.quantity > 0
  ) {
    const placeholder: PlannerSession = {
      id: 'preview',
      date,
      categoryId: preview.categoryId,
      start: preview.start,
      end: preview.end,
      capacity: preview.quantity,
      booked: 0,
    };
    entries.push({ ...placeholder, extraPreview: true });
  }

  const minutes = entries.reduce((n, e) => n + minutesOf(e), 0);
  const counts = new Map<CategoryId, DaySlice>();
  for (const e of entries) {
    let slice = counts.get(e.categoryId);
    if (!slice) {
      slice = { categoryId: e.categoryId, minutes: 0, terms: 0, slots: 0 };
      counts.set(e.categoryId, slice);
    }
    slice.minutes += minutesOf(e);
    slice.terms++;
    slice.slots += Number(e.capacity || 0);
  }
  const order = (id: CategoryId): number => ctx.categories.findIndex((c) => c.id === id);
  const slices = [...counts.values()].sort((a, b) => order(a.categoryId) - order(b.categoryId));
  const budget = ctx.dayBudgetMinutes;
  return {
    date,
    entries,
    minutes,
    ratio: Math.min(1, minutes / budget),
    percent: Math.min(100, Math.round((minutes / budget) * 100)),
    slices,
    slots: entries.reduce((n, e) => n + Number(e.capacity || 0), 0),
  };
}

/**
 * Everything a mini-calendar cell draws (the SVG ring arcs, the liquid level,
 * the accessible label). With several staff planned in parallel the arcs are
 * normalised to the ring: `ringMinutes = max(budget, planned)`.
 */
export function miniCellModel(ctx: PlannerContext, date: IsoDate, preview?: Preview | null): MiniCellModel {
  const d = dateOf(date);
  const p = computeDayPlan(ctx, date, preview);
  const base = {
    date,
    dayNumber: d.getDate(),
    hasTerms: p.entries.length > 0,
    percent: p.percent,
    termCount: p.entries.length,
    slotCount: p.slots,
    ariaLabel: `${printable(d)} ${d.getFullYear()} · ${p.entries.length} termínů · ${p.slots} slotů · ${p.percent}% plánovací kapacity`,
  };
  if (!p.entries.length) return { ...base, ring: null };

  const ringMinutes = Math.max(ctx.dayBudgetMinutes, p.minutes);
  const scale = RING_CIRCUMFERENCE / ringMinutes;
  let offset = 0;
  const arcs: RingArc[] = p.slices.map((slice) => {
    const span = slice.minutes * scale;
    const gap = Math.min(1.6, span * 0.14);
    const arc: RingArc = {
      categoryId: slice.categoryId,
      color: categoryOrFallback(ctx, slice.categoryId).color,
      dash: Math.max(0.1, span - gap),
      offset: -offset,
    };
    offset += span;
    return arc;
  });
  return { ...base, ring: { circumference: RING_CIRCUMFERENCE, arcs, liquidPercent: p.ratio * 100, layers: liquidLayers(ctx, p.entries) } };
}

export interface TooltipEventModel {
  id: string;
  categoryId: CategoryId;
  name: string;
  tone: string;
  /** "08:00–10:00 · Klub" */
  meta: string;
  /** "12 slotů" */
  slotsLabel: string;
}

/** One činnost of the day in the flyout (reviewer 2.2): the row, and the entries behind it for when it is opened. */
export interface TooltipGroupModel {
  key: string;
  categoryId: CategoryId;
  name: string;
  /** "Komplexní prohlídka ×10". */
  title: string;
  tone: string;
  /** "×10", or "" for a single one. */
  countMark: string;
  /** Slots of the činnost that day (people of the bookings, capacity of the windows). */
  slots: number;
  /** "10 slotů". */
  slotsLabel: string;
  /** "08:00–17:20". */
  timeLabel: string;
  entries: { id: string; kind: GroupEntryKind; /** "08:00–09:00" */ time: string; /** "Klub" / "Veřejné" / "Objednávka" */ source: string; slotsLabel: string; names: string[] }[];
}

export interface DayTooltipModel {
  date: IsoDate;
  pinned: boolean;
  /** "Pátek 20. 11." */
  heading: string;
  percent: number;
  bars: { categoryId: CategoryId; color: string; widthPercent: number }[];
  plannedLabel: string;
  referenceLabel: string;
  stats: { terms: number; slots: number; plannedTime: string };
  events: TooltipEventModel[];
  /** The same day summed per činnost - what the flyout draws; `events` is the prototype's per-term list (golden). */
  groups: TooltipGroupModel[];
}

const SOURCE_WORD: Record<GroupEntryKind, string> = { club: 'Klub', term: 'Veřejné', booking: 'Objednávka' };

/** Hover / pinned flyout of a day; null when the day has no terms (the prototype shows nothing). */
export function dayTooltipModel(ctx: PlannerContext, date: IsoDate, pinned: boolean): DayTooltipModel | null {
  const p = computeDayPlan(ctx, date);
  if (!p.entries.length) return null;
  const d = dateOf(date);
  return {
    date,
    pinned,
    heading: `${weekdayFull(date)} ${d.getDate()}. ${d.getMonth() + 1}.`,
    percent: p.percent,
    bars: p.slices.map((s) => ({
      categoryId: s.categoryId,
      color: categoryOrFallback(ctx, s.categoryId).color,
      // The prototype writes `toFixed(2)`; the number is kept unclamped on purpose.
      widthPercent: Number(((s.minutes / ctx.dayBudgetMinutes) * 100).toFixed(2)),
    })),
    plannedLabel: `Naplánováno ${clockDuration(p.minutes)}`,
    referenceLabel: `Referenční den ${clockDuration(ctx.dayBudgetMinutes)}`,
    stats: { terms: p.entries.length, slots: p.slots, plannedTime: clockDuration(p.minutes) },
    events: p.entries.map((e) => ({
      id: e.id,
      categoryId: e.categoryId,
      name: categoryOrFallback(ctx, e.categoryId).name,
      tone: categoryOrFallback(ctx, e.categoryId).color,
      meta: `${e.start}–${e.end} · ${sourceFor(e) === 'public' ? 'Veřejné' : 'Klub'}`,
      slotsLabel: `${e.capacity} slotů`,
    })),
    groups: groupByActivity(ctx, p.entries).map((g) => ({
      key: g.key,
      categoryId: g.categoryId,
      name: g.name,
      title: groupTitle(g),
      tone: g.tone,
      countMark: countMark(g),
      slots: g.slots,
      slotsLabel: slotsText(g.slots),
      timeLabel: spanText(g),
      entries: g.entries.map((e) => ({ id: e.id, kind: e.kind, time: `${e.start}–${e.end}`, source: SOURCE_WORD[e.kind], slotsLabel: slotsText(e.slots), names: e.names })),
    })),
  };
}
