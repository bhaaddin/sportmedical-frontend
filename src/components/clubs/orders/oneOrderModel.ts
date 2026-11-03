/*
 * One order per club: the rules of the screens, with no React in them (so they are tested on their own).
 *
 *  - who may be split off the order, and why not (invoiced, cancelled, the root itself);
 *  - what a split must look like (at least one day, never all of them);
 *  - which days an invoice can still take and how "Jeden den / Měsíc / Vše zbývající" becomes the subset the API wants.
 */
import type { CombinedDay, CombinedOrder } from '../../../api/clubOneOrder';
import type { InvoiceSubset } from '../../../api/clubOrders';
import { rangeLine } from '../order/orderFormat';

/** Why a day cannot be split off; null = it can. */
export function splitBlocker(day: CombinedDay, rootId: string): string | null {
  if (day.orderId === rootId) return 'Základ objednávky se neodděluje';
  if (day.invoiceId !== null) return 'Už je na faktuře';
  if (day.status === 'Cancelled') return 'Je zrušená';
  return null;
}

/** What is wrong with the chosen days; null = the split can go on. */
export function splitProblem(selected: readonly string[], combined: CombinedOrder): string | null {
  if (selected.length === 0) return 'Vyberte aspoň jeden den.';
  if (selected.length >= combined.days.length) return 'Nelze oddělit všechno - zůstat musí aspoň základ objednávky.';
  return null;
}

/** Days an invoice can still take: not invoiced, not cancelled. */
export const invoiceableDays = (combined: CombinedOrder): CombinedDay[] =>
  combined.days.filter((d) => d.invoiceId === null && d.status !== 'Cancelled');

export const dayStart = (day: CombinedDay): string => [...day.ranges.map((r) => r.fromDate)].sort()[0] ?? '';

/** "26. 10. 2026, 08:00–10:15"; several terms joined with " · ". */
export const dayWhen = (day: CombinedDay): string => (day.ranges.length === 0 ? 'Bez termínu' : day.ranges.map(rangeLine).join(' · '));

/** The months (yyyy-MM, oldest first) that still have something to bill. */
export function invoiceableMonths(combined: CombinedOrder): string[] {
  const months = new Set<string>();
  for (const d of invoiceableDays(combined)) {
    const m = dayStart(d).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) months.add(m);
  }
  return [...months].sort();
}

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export type InvoiceScope = 'day' | 'month' | 'rest';

/** The subset for the API: one day = `orderIds`, a month = `month`, everything remaining = none (the whole rest). */
export function invoiceSubset(scope: InvoiceScope, pick: { orderId?: string; month?: string }): InvoiceSubset | undefined {
  if (scope === 'day') return pick.orderId ? { orderIds: [pick.orderId] } : undefined;
  if (scope === 'month') return pick.month ? { month: pick.month } : undefined;
  return undefined;
}

/** A scope is ready to ask the server when it has what it needs ("Vše zbývající" always). */
export const scopeReady = (scope: InvoiceScope, pick: { orderId?: string; month?: string }): boolean =>
  scope === 'rest' || invoiceSubset(scope, pick) !== undefined;

/**
 * The orders list in one-order mode: of a club in the mode, an added day ("dodatek", it points at its root) is not a row
 * of its own - the root's row stands for the whole order. Only when the root is in the list; orders of other clubs and
 * roots are kept as they are.
 */
export function collapseToRoots<T extends { id: string; clubId: string; parentOrderId: string | null }>(
  live: readonly T[],
  oneOrderClubIds: readonly string[],
): T[] {
  if (oneOrderClubIds.length === 0) return [...live];
  const liveIds = new Set(live.map((o) => o.id));
  return live.filter((o) => !(o.parentOrderId !== null && oneOrderClubIds.includes(o.clubId) && liveIds.has(o.parentOrderId)));
}
