/*
 * The agenda under the mini-calendar ("Plánované činnosti" / "Všechny termíny"),
 * the full list dialog, the term detail, search and notifications.
 *
 * Port of `agendaEvents`, `agendaRow`, `renderAppointments`, `openAgendaDetail`,
 * `openAgendaFullList` (filter + grouping), `openEvent` (public term),
 * `searchDialog` and `notifications` as plain data.
 *
 * The agenda is derived from planner terms, not from reservations: no
 * participant counts are shown for club terms.
 */
import {
  categoryOrFallback,
  demandOf,
  listVisible,
  orderCategoryIds,
  slotMinutesOf,
  sourceFor,
} from './context';
import { plannedOf } from './order';
import {
  addDays,
  agendaHours,
  agendaSlotLabel,
  agendaTermLabel,
  dateOf,
  dayCode,
  monthGenitives,
  printable,
  shortDateWithYear,
  termWord,
  timeAsMinutes,
} from './time';
import type {
  AgendaMode,
  AgendaRowModel,
  AgendaScope,
  CategoryId,
  IsoDate,
  PlannerContext,
  PlannerSession,
} from './types';

/** Every CREATED calendar term (club terms of the order + public ones). */
export const agendaEvents = (ctx: PlannerContext): PlannerSession[] => listVisible(ctx).slice();

export interface AgendaUi {
  mode: AgendaMode;
  /** Selected činnost chip; null/unknown falls back to the first ordered one. */
  categoryId: CategoryId | null;
  scope: AgendaScope;
}

export const initialAgendaUi: AgendaUi = { mode: 'activities', categoryId: null, scope: 'all' };

/** `if(!visible.includes(agendaUI.type)) type = visible[0]`. */
export function resolveAgendaCategory(ctx: PlannerContext, wanted: CategoryId | null): CategoryId | null {
  const ids = orderCategoryIds(ctx);
  if (wanted && ids.includes(wanted)) return wanted;
  return ids[0] ?? null;
}

export function agendaRowModel(ctx: PlannerContext, e: PlannerSession): AgendaRowModel {
  const date = dateOf(e.date);
  const c = categoryOrFallback(ctx, e.categoryId);
  const shortTime = `${e.start}–${e.end}`;
  const slots = Math.max(0, Number(e.capacity) || 0);
  return {
    id: e.id,
    date: e.date,
    dayLabel: `${date.getDate()}. ${date.getMonth() + 1}.`,
    dayCode: dayCode(e.date),
    name: c.name,
    tone: c.color,
    iconKey: c.iconKey,
    timeRange: shortTime,
    slots,
    slotLabel: agendaSlotLabel(slots),
    title: `${c.name} · ${printable(date)} ${shortTime} · ${e.capacity} slotů`,
  };
}

export interface AgendaPanelModel {
  mode: AgendaMode;
  scope: AgendaScope;
  categoryId: CategoryId | null;
  totalCount: number;
  chips: { categoryId: CategoryId; label: string; tone: string; active: boolean }[];
  kpi: {
    name: string;
    tone: string;
    planned: number;
    requested: number;
    fillPercent: number;
    termCountLabel: string;
    remainingLabel: string;
  } | null;
  termCaption: string;
  activityRows: AgendaRowModel[];
  activityEmpty: string;
  scopeNote: string;
  allTotals: { terms: number; termsLabel: string; slots: number; slotsLabel: string };
  allRows: AgendaRowModel[];
  allEmpty: string;
  footerStatus: string;
}

export function agendaPanelModel(
  ctx: PlannerContext,
  ui: AgendaUi,
  view: { weekStart: IsoDate; selectedDate: IsoDate },
): AgendaPanelModel {
  const all = agendaEvents(ctx);
  const type = resolveAgendaCategory(ctx, ui.categoryId);
  const d = type ? demandOf(ctx, type) : undefined;
  const planned = type ? plannedOf(ctx, type) : 0;
  const requested = d?.requested ?? 0;
  const remaining = Math.max(0, requested - planned);
  const typeEvents = type ? all.filter((e) => e.categoryId === type) : [];
  const first = view.weekStart;
  const last = addDays(view.weekStart, 6);
  let filtered = all;
  if (ui.scope === 'day') filtered = all.filter((e) => e.date === view.selectedDate);
  else if (ui.scope === 'week') filtered = all.filter((e) => e.date >= first && e.date <= last);
  const slots = filtered.reduce((sum, e) => sum + Math.max(0, Number(e.capacity) || 0), 0);
  const cat = type ? categoryOrFallback(ctx, type) : null;
  return {
    mode: ui.mode,
    scope: ui.scope,
    categoryId: type,
    totalCount: all.length,
    chips: orderCategoryIds(ctx).map((id) => {
      const c = categoryOrFallback(ctx, id);
      return { categoryId: id, label: c.shortName ?? c.name, tone: c.color, active: id === type };
    }),
    kpi: cat
      ? {
          name: cat.name,
          tone: cat.color,
          planned,
          requested,
          fillPercent: requested ? Math.min(100, (planned / requested) * 100) : 0,
          termCountLabel: `${typeEvents.length} ${agendaTermLabel(typeEvents.length)}`,
          remainingLabel: remaining ? `zbývá ${remaining} ${agendaSlotLabel(remaining)}` : '✓ Naplánováno',
        }
      : null,
    termCaption: `${typeEvents.length} ${termWord(typeEvents.length)}`,
    activityRows: typeEvents.map((e) => agendaRowModel(ctx, e)),
    activityEmpty: 'Pro tuto činnost zatím nejsou vytvořené termíny.',
    scopeNote:
      ui.scope === 'day'
        ? `Datum ${printable(dateOf(view.selectedDate))}`
        : ui.scope === 'week'
          ? 'Aktuální týden'
          : 'Chronologický přehled',
    allTotals: {
      terms: filtered.length,
      termsLabel: agendaTermLabel(filtered.length),
      slots,
      slotsLabel: `${agendaSlotLabel(slots)} celkem`,
    },
    allRows: filtered.map((e) => agendaRowModel(ctx, e)),
    allEmpty: 'V tomto období nejsou vytvořené termíny.',
    footerStatus:
      ui.mode === 'activities'
        ? `Zbývá ${remaining} ${agendaSlotLabel(remaining)} naplánovat`
        : `${all.length} termínů v kalendáři`,
  };
}

/* ------------------------------ full list dialog ------------------------------ */

export interface AgendaFullFilter {
  query: string;
  categoryId: CategoryId | 'all';
  /** `yyyy-MM-dd` or ''. */
  date: string;
}

export interface AgendaFullListModel {
  stats: { terms: number; slots: number; time: string };
  groups: {
    date: IsoDate;
    title: string;
    summary: string;
    rows: { id: string; timeRange: string; name: string; subtitle: string; tone: string; slotsLabel: string }[];
  }[];
  empty: string;
}

export function agendaFullListModel(ctx: PlannerContext, f: AgendaFullFilter): AgendaFullListModel {
  const q = f.query.trim().toLocaleLowerCase('cs-CZ');
  const filtered = agendaEvents(ctx).filter((e) => {
    const name = categoryOrFallback(ctx, e.categoryId).name;
    const searchable = `${name} ${dayCode(e.date)} ${printable(dateOf(e.date))} ${e.date} ${e.start} ${e.end}`.toLocaleLowerCase('cs-CZ');
    return (f.categoryId === 'all' || e.categoryId === f.categoryId) && (!f.date || e.date === f.date) && (!q || searchable.includes(q));
  });
  const totalSlots = filtered.reduce((n, e) => n + Math.max(0, Number(e.capacity) || 0), 0);
  const minutes = filtered.reduce((n, e) => n + Math.max(0, timeAsMinutes(e.end) - timeAsMinutes(e.start)), 0);
  const byDay = new Map<IsoDate, PlannerSession[]>();
  for (const e of filtered) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  return {
    stats: { terms: filtered.length, slots: totalSlots, time: agendaHours(minutes) },
    groups: [...byDay].map(([day, events]) => {
      const date = dateOf(day);
      const count = events.reduce((n, e) => n + Number(e.capacity || 0), 0);
      return {
        date: day,
        title: `${dayCode(day)} ${date.getDate()}. ${monthGenitives[date.getMonth()]} ${date.getFullYear()}`,
        summary: `${events.length} ${termWord(events.length)} · ${count} ${agendaSlotLabel(count)}`,
        rows: events.map((e) => {
          const c = categoryOrFallback(ctx, e.categoryId);
          const n = Number(e.capacity) || 0;
          return {
            id: e.id,
            timeRange: `${e.start}–${e.end}`,
            name: c.name,
            subtitle: c.subtitle ?? '',
            tone: c.color,
            slotsLabel: `${n} ${agendaSlotLabel(n)}`,
          };
        }),
      };
    }),
    empty: 'Žádné termíny neodpovídají vybraným filtrům.',
  };
}

/* ------------------------------ term detail ------------------------------ */

export interface AgendaDetailModel {
  id: string;
  name: string;
  iconKey: string;
  tone: string;
  dateline: string;
  subline: string;
  stats: { time: string; slots: string; length: string };
  note: string;
  isClub: boolean;
}

/** `openAgendaDetail`: a club term (planning view, never reservations). */
export function agendaDetailModel(ctx: PlannerContext, e: PlannerSession): AgendaDetailModel {
  const c = categoryOrFallback(ctx, e.categoryId);
  const slot = slotMinutesOf(ctx, e.categoryId);
  const date = dateOf(e.date);
  const duration = Math.max(0, timeAsMinutes(e.end) - timeAsMinutes(e.start));
  const requested = demandOf(ctx, e.categoryId)?.requested ?? 0;
  const remaining = Math.max(0, requested - plannedOf(ctx, e.categoryId));
  const club = sourceFor(e) === 'club';
  const note = club
    ? `V objednávce zbývá naplánovat ${remaining} ${agendaSlotLabel(remaining)} pro tuto činnost.`
    : 'Termín je součástí sdíleného kalendáře.';
  return {
    id: e.id,
    name: c.name,
    iconKey: c.iconKey,
    tone: c.color,
    dateline: `${dayCode(e.date)} ${printable(date)} ${date.getFullYear()}`,
    subline: `${c.subtitle ?? ''} · ${slot} min / slot`,
    stats: {
      time: `${e.start}–${e.end}`,
      slots: `${e.capacity} ${agendaSlotLabel(Number(e.capacity) || 0)}`,
      length: agendaHours(duration),
    },
    note: `${note} Rozšíření termínu provedete tažením jeho horního nebo spodního okraje v kalendáři. Tento plánovací přehled nezobrazuje rezervace sportovců.`,
    isClub: club,
  };
}

export interface PublicEventDetailModel {
  id: string;
  name: string;
  iconKey: string;
  dateline: string;
  time: string;
  occupancy: string;
  free: string;
  fillPercent: number;
  fillBar: number;
}

/** `openEvent` for a PUBLIC term: the booking view. */
export function publicEventDetailModel(ctx: PlannerContext, e: PlannerSession): PublicEventDetailModel {
  const c = categoryOrFallback(ctx, e.categoryId);
  const ratio = Math.round((e.booked / e.capacity) * 100);
  return {
    id: e.id,
    name: c.name,
    iconKey: c.iconKey,
    dateline: shortDateWithYear(e.date),
    time: `${e.start} – ${e.end}`,
    occupancy: `${e.booked} / ${e.capacity} osob`,
    free: `${Math.max(0, e.capacity - e.booked)} volných míst`,
    fillPercent: ratio,
    fillBar: Math.min(100, ratio),
  };
}

/* ------------------------------ search / notifications ------------------------------ */

export function searchTerms(ctx: PlannerContext, needle: string) {
  const n = needle.toLocaleLowerCase('cs-CZ');
  return listVisible(ctx)
    .filter((e) => `${categoryOrFallback(ctx, e.categoryId).name} ${printable(dateOf(e.date))} ${e.start}`.toLocaleLowerCase('cs-CZ').includes(n))
    .map((e) => ({
      id: e.id,
      label: `${categoryOrFallback(ctx, e.categoryId).name}   ${printable(dateOf(e.date))} ${e.start}`,
      aux: `${e.booked}/${e.capacity}`,
    }));
}

export function notificationsModel(ctx: PlannerContext) {
  const list = listVisible(ctx);
  const empty = list.filter((x) => x.booked === 0);
  const full = list.filter((x) => x.booked === x.capacity);
  return {
    summary: `${full.length} termíny s plnou kapacitou · ${empty.length} termínů bez rezervací`,
    full: full.slice(0, 3).map((e) => ({ id: e.id, label: `Plná kapacita · ${categoryOrFallback(ctx, e.categoryId).name}`, aux: `${e.booked}/${e.capacity}` })),
    empty: empty.slice(0, 3).map((e) => ({ id: e.id, label: `Zatím bez rezervací · ${categoryOrFallback(ctx, e.categoryId).name}`, aux: `0/${e.capacity}` })),
  };
}

