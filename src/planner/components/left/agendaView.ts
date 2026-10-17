/*
 * The agenda's numbers for BOTH ways the planner is used.
 *
 *  - planning a club order (the order has demands): `agendaPanelModel` of the model, unchanged -
 *    chips = the ordered činnosti, KPI = planned seats against the ordered ones, footer = what is left;
 *  - standard booking (no club order, no demands): the same lists over the clinic's own sessions of the
 *    loaded range. Chips are the činnosti that have a session, the KPI has nothing to measure against
 *    (no ordered seats), so it shows the činnost's share of the visible slots instead of "zbývá".
 */
import {
  agendaPanelModel,
  agendaRowModel,
  agendaSlotLabel,
  addDays,
  categoryOrFallback,
  dateOf,
  printable,
  termWord,
  type AgendaPanelModel,
  type AgendaUi,
  type CategoryId,
  type IsoDate,
  type PlannerContext,
  type PlannerSession,
} from '../../model';

export interface AgendaView extends AgendaPanelModel {
  /** `true` when there is no club order behind the planner (standard booking). */
  standard: boolean;
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

/** A term of the order being planned: not another club's window and not the booking of an individual. */
export const isTermOfOrder = (e: PlannerSession): boolean => e.foreign !== true && !(e.appointments && e.appointments.length > 0);

export function agendaView(
  ctx: PlannerContext,
  ui: AgendaUi,
  view: { weekStart: IsoDate; selectedDate: IsoDate },
  /** What the source says the board plans; absent = a club order exactly when the order has demands. */
  mode?: 'club' | 'standard',
): AgendaView {
  const club = mode ? mode === 'club' : ctx.demands.length > 0;
  // Other clubs' windows and the clinic's own bookings are busy time on the board, not terms of the order being planned.
  if (club) return { ...agendaPanelModel({ ...ctx, sessions: ctx.sessions.filter(isTermOfOrder) }, ui, view), standard: false };

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
  const slotsOf = (list: readonly PlannerSession[]) => list.reduce((n, e) => n + Math.max(0, Number(e.capacity) || 0), 0);
  const allSlots = slotsOf(all);
  const typeSlots = slotsOf(typeEvents);
  const cat = type ? categoryOrFallback(ctx, type) : null;
  const share = allSlots ? Math.round((typeSlots / allSlots) * 100) : 0;

  return {
    standard: true,
    mode: ui.mode,
    scope: ui.scope,
    categoryId: type,
    totalCount: all.length,
    chips: chipCategories.map((c) => ({ categoryId: c.id, label: c.shortName ?? c.name, tone: c.color, active: c.id === type })),
    kpi: cat
      ? {
          name: cat.name,
          tone: cat.color,
          planned: typeSlots,
          requested: allSlots,
          fillPercent: allSlots ? Math.min(100, (typeSlots / allSlots) * 100) : 0,
          termCountLabel: `${typeEvents.length} ${termWord(typeEvents.length)}`,
          remainingLabel: `${share} % všech slotů`,
        }
      : null,
    termCaption: `${typeEvents.length} ${termWord(typeEvents.length)}`,
    activityRows: typeEvents.map((e) => agendaRowModel(ctx, e)),
    activityEmpty: 'Pro tuto činnost zatím nejsou v kalendáři žádné termíny.',
    scopeNote:
      ui.scope === 'day'
        ? `Datum ${printable(dateOf(view.selectedDate))}`
        : ui.scope === 'week'
          ? 'Aktuální týden'
          : 'Zobrazené období',
    allTotals: {
      terms: filtered.length,
      termsLabel: termWord(filtered.length),
      slots: slotsOf(filtered),
      slotsLabel: `${agendaSlotLabel(slotsOf(filtered))} celkem`,
    },
    allRows: filtered.map((e) => agendaRowModel(ctx, e)),
    allEmpty: 'V tomto období nejsou v kalendáři žádné termíny.',
    footerStatus:
      ui.mode === 'activities'
        ? `${typeEvents.length} ${termWord(typeEvents.length)} v přehledu`
        : `${all.length} termínů v kalendáři`,
  };
}

