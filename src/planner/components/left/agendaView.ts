/*
 * The agenda's numbers for BOTH ways the planner is used.
 *
 *  - planning a club order (the order has demands): `agendaPanelModel` of the model, unchanged -
 *    chips = the ordered činnosti, KPI = planned seats against the ordered ones, footer = what is left;
 *  - standard booking (no club order, no demands): the same lists over the clinic's own sessions of the
 *    loaded range. Chips are the činnosti that have a session, the KPI has nothing to measure against
 *    (no ordered seats), so it shows the činnost's share of the visible slots instead of "zbývá".
 */
import { categoryPriceText, categoryWithPrice } from '../categoryPrice';
import type { OrderFigures } from '../plan/orderFigures';
import {
  agendaPanelModel,
  agendaRowModel,
  agendaSlotLabel,
  addDays,
  categoryOrFallback,
  dateOf,
  groupByActivity,
  groupTitle,
  printable,
  slotsOfSession,
  termWord,
  type AgendaPanelModel,
  type AgendaUi,
  type CategoryId,
  type IsoDate,
  type PlannerContext,
  type PlannerSession,
} from '../../model';

/** What a činnost costs, in the words of the price list ("1 600 Kč" / "bez ceny"); only standard booking shows it. */
export type AgendaChipView = AgendaPanelModel['chips'][number] & {
  /** Tooltip and accessible name: the full name with the price. */
  title?: string;
};

export interface AgendaView extends Omit<AgendaPanelModel, 'chips' | 'kpi'> {
  /** `true` when there is no club order behind the planner (standard booking). */
  standard: boolean;
  chips: AgendaChipView[];
  kpi: (NonNullable<AgendaPanelModel['kpi']> & { priceText?: string }) | null;
}

/**
 * Every session of the loaded range that the agenda may list (standard booking: all of them). A window of a
 * club that names no činnost has nothing to be listed under and is left out.
 */
function standardEvents(ctx: PlannerContext): PlannerSession[] {
  return ctx.sessions
    .filter((e) => e.showInList !== false && e.categoryId !== '')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/**
 * The standard lists' rows: one per činnost and day (reviewer 2.2) - "26. 10. Komplexní prohlídka ×10 · 10 slotů" - instead of one
 * per booking. A činnost with one entry on the day keeps its own row (and its detail); several fold into a group row.
 */
function groupedRows(ctx: PlannerContext, events: readonly PlannerSession[]): AgendaView['activityRows'] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return groupByActivity(ctx, events, { perDay: true }).map((g) => {
    const single = g.entries.length === 1 ? byId.get(g.entries[0]!.id) : undefined;
    if (single) return { ...agendaRowModel(ctx, single), slots: g.slots, slotLabel: agendaSlotLabel(g.slots) };
    const first = byId.get(g.entries[0]!.id)!;
    const base = agendaRowModel(ctx, first);
    const title = groupTitle(g);
    const date = dateOf(g.date as IsoDate);
    return {
      ...base,
      id: `group:${g.key}`,
      name: title,
      timeRange: `${g.start}–${g.end}`,
      slots: g.slots,
      slotLabel: agendaSlotLabel(g.slots),
      title: `${title} · ${printable(date)} ${g.start}–${g.end} · ${g.slots} ${agendaSlotLabel(g.slots)}`,
      group: { count: g.count, entryIds: g.entries.map((e) => e.id) },
    };
  });
}

/** A term of the order being planned: not another club's window and not the booking of an individual. */
export const isTermOfOrder = (e: PlannerSession): boolean => e.foreign !== true && !(e.appointments && e.appointments.length > 0);

export function agendaView(
  ctx: PlannerContext,
  ui: AgendaUi,
  view: { weekStart: IsoDate; selectedDate: IsoDate },
  /** What the source says the board plans; absent = a club order exactly when the order has demands. */
  mode?: 'club' | 'standard',
  /** The order's one calculation: the KPI and the footer read the players from it (lanes, past terms, ...), not from a second sum. */
  figures?: OrderFigures,
): AgendaView {
  const club = mode ? mode === 'club' : ctx.demands.length > 0;
  // Other clubs' windows and the clinic's own bookings are busy time on the board, not terms of the order being planned.
  if (club) {
    const model = agendaPanelModel({ ...ctx, sessions: ctx.sessions.filter(isTermOfOrder) }, ui, view);
    const f = figures && model.categoryId ? figures.byId.get(model.categoryId) : undefined;
    if (!f || !model.kpi) return { ...model, standard: false };
    const remainingLabel = f.remaining > 0 ? `zbývá ${f.remaining} ${agendaSlotLabel(f.remaining)}` : '✓ Naplánováno';
    return {
      ...model,
      standard: false,
      kpi: { ...model.kpi, planned: f.planned, requested: f.requested, fillPercent: f.requested > 0 ? Math.min(100, (f.planned / f.requested) * 100) : 0, remainingLabel },
      footerStatus: ui.mode === 'activities' ? `Zbývá ${f.remaining} ${agendaSlotLabel(f.remaining)} naplánovat` : model.footerStatus,
    };
  }

  const all = standardEvents(ctx);
  const present = ctx.categories.filter((c) => all.some((e) => e.categoryId === c.id));
  const extra = [...new Set(all.map((e) => e.categoryId))]
    .filter((id) => !present.some((c) => c.id === id))
    .map((id) => categoryOrFallback(ctx, id));
  const chipCategories = [...present, ...extra];
  const type: CategoryId | null =
    ui.categoryId && chipCategories.some((c) => c.id === ui.categoryId) ? ui.categoryId : (chipCategories[0]?.id ?? null);
  const typeEvents = type ? all.filter((e) => e.categoryId === type) : [];

  const first = view.weekStart;
  const last = addDays(view.weekStart, 6);
  let filtered = all;
  if (ui.scope === 'day') filtered = all.filter((e) => e.date === view.selectedDate);
  else if (ui.scope === 'week') filtered = all.filter((e) => e.date >= first && e.date <= last);
  /* Slots by the one rule of the summaries: the people of a booking, the capacity of a window (never a booking's free parallel seats). */
  const slotsOf = (list: readonly PlannerSession[]) => list.reduce((n, e) => n + slotsOfSession(e), 0);
  const countOf = (list: readonly PlannerSession[]) => groupByActivity(ctx, list).reduce((n, g) => n + g.count, 0);
  const allSlots = slotsOf(all);
  const typeSlots = slotsOf(typeEvents);
  const cat = type ? categoryOrFallback(ctx, type) : null;
  const share = allSlots ? Math.round((typeSlots / allSlots) * 100) : 0;

  return {
    standard: true,
    mode: ui.mode,
    scope: ui.scope,
    categoryId: type,
    totalCount: countOf(all),
    chips: chipCategories.map((c) => ({
      categoryId: c.id,
      label: c.shortName ?? c.name,
      tone: c.color,
      active: c.id === type,
      title: categoryWithPrice(c),
    })),
    kpi: cat
      ? {
          name: cat.name,
          priceText: categoryPriceText(cat),
          tone: cat.color,
          planned: typeSlots,
          requested: allSlots,
          fillPercent: allSlots ? Math.min(100, (typeSlots / allSlots) * 100) : 0,
          termCountLabel: `${countOf(typeEvents)} ${termWord(countOf(typeEvents))}`,
          remainingLabel: `${share} % všech slotů`,
        }
      : null,
    termCaption: `${countOf(typeEvents)} ${termWord(countOf(typeEvents))}`,
    activityRows: groupedRows(ctx, typeEvents),
    activityEmpty: 'Pro tuto činnost zatím nejsou v kalendáři žádné termíny.',
    scopeNote:
      ui.scope === 'day'
        ? `Datum ${printable(dateOf(view.selectedDate))}`
        : ui.scope === 'week'
          ? 'Aktuální týden'
          : 'Zobrazené období',
    allTotals: {
      terms: countOf(filtered),
      termsLabel: termWord(countOf(filtered)),
      slots: slotsOf(filtered),
      slotsLabel: `${agendaSlotLabel(slotsOf(filtered))} celkem`,
    },
    allRows: groupedRows(ctx, filtered),
    allEmpty: 'V tomto období nejsou v kalendáři žádné termíny.',
    footerStatus:
      ui.mode === 'activities'
        ? `${countOf(typeEvents)} ${termWord(countOf(typeEvents))} v přehledu`
        : `${countOf(all)} termínů v kalendáři`,
  };
}

