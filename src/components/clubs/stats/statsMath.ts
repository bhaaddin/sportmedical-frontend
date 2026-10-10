/*
 * Statistiky klubů - the arithmetic on the `GET /club-orders/stats` answer. Pure and tolerant: an absent field
 * reads as 0 / empty so an older server never white-screens the page.
 */
import type { ClubOrderStats, ClubOrderStatus, ClubOrderView, ClubSummary } from '../../../api/clubOrders';
import { ORDER_STATUSES } from '../../../api/clubOrders';
import { liveTotalsByClub } from '../orders/orderMoney';

export interface NormalSummary extends Omit<ClubSummary, 'ordersByStatus'> {
  ordersByStatus: Record<ClubOrderStatus, number>;
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function normalizeSummary(s: Partial<ClubSummary> | null | undefined): NormalSummary {
  const x = s ?? {};
  const totalSeats = n(x.totalSeats);
  const registered = n(x.registered);
  const by: Record<ClubOrderStatus, number> = { Invited: 0, Requested: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
  for (const k of ORDER_STATUSES) by[k] = n(x.ordersByStatus?.[k]);
  return {
    clubId: x.clubId ?? '',
    clubName: x.clubName ?? '',
    totalSeats,
    registered,
    remaining: typeof x.remaining === 'number' ? Math.max(0, x.remaining) : Math.max(0, totalSeats - registered),
    byService: x.byService ?? [],
    byActivity: x.byActivity ?? [],
    ordersByStatus: by,
    bookedMinutes: n(x.bookedMinutes),
    usedMinutes: n(x.usedMinutes),
  };
}

/** Orders that still count: everything except the cancelled ones. */
export const activeOrders = (s: NormalSummary): number =>
  ORDER_STATUSES.filter((k) => k !== 'Cancelled').reduce((sum, k) => sum + s.ordersByStatus[k], 0);

/** Share of the booked window minutes that athletes occupy, 0-100; null when nothing is booked. */
export function occupancyPercent(s: NormalSummary): number | null {
  if (s.bookedMinutes <= 0) return null;
  return Math.min(100, Math.round((s.usedMinutes / s.bookedMinutes) * 100));
}

export interface StatsKpis {
  clubs: number;
  orders: number;
  players: number;
  registered: number;
  remaining: number;
  occupancy: number | null;
}

export function statsKpis(stats: ClubOrderStats): StatsKpis {
  const totals = normalizeSummary(stats.totals);
  return {
    clubs: (stats.byClub ?? []).length,
    orders: activeOrders(totals),
    players: totals.totalSeats,
    registered: totals.registered,
    remaining: totals.remaining,
    occupancy: occupancyPercent(totals),
  };
}

export const percentText = (p: number | null): string => (p === null ? '—' : `${p} %`);

/** Rows for the per-club table and its CSV, biggest club first. */
export function clubRows(stats: ClubOrderStats): NormalSummary[] {
  return (stats.byClub ?? []).map(normalizeSummary).sort((a, b) => b.totalSeats - a.totalSeats || a.clubName!.localeCompare(b.clubName ?? '', 'cs'));
}

export interface ServiceRow { serviceName: string; seats: number; registered: number; remaining: number }
export interface ActivityRow { activityName: string; serviceName: string; seats: number; registered: number; remaining: number }

export function serviceRows(stats: ClubOrderStats): ServiceRow[] {
  return (stats.byService ?? []).map((s) => ({
    serviceName: s.serviceName,
    seats: n(s.seats),
    registered: n(s.registered),
    remaining: Math.max(0, n(s.seats) - n(s.registered)),
  }));
}

export function activityRows(stats: ClubOrderStats): ActivityRow[] {
  return (stats.byActivity ?? []).map((a) => ({
    activityName: a.activityName,
    serviceName: a.serviceName,
    seats: n(a.seats),
    registered: n(a.registered),
    remaining: typeof a.remaining === 'number' ? Math.max(0, a.remaining) : Math.max(0, n(a.seats) - n(a.registered)),
  }));
}

export const isEmptyStats = (stats: ClubOrderStats): boolean =>
  (stats.byClub ?? []).length === 0 && normalizeSummary(stats.totals).totalSeats === 0;

/* ── Etapa 12: the money next to the counts ── */

export interface ClubRevenue {
  /** Every club's live (Requested / Confirmed) orders' totals added up. */
  totalCzk: number;
  /** The same per club id; a club with no priced live order is absent. */
  byClub: Map<string, number>;
}

/**
 * The orders' value, from the orders list of the same period: the live orders' quoted totals, per club and in all.
 * null when the list did not load (the counts stand on their own; the money is an enrichment).
 */
export function clubRevenue(orders: readonly Pick<ClubOrderView, 'clubId' | 'status' | 'priceQuote'>[] | undefined): ClubRevenue | null {
  if (orders === undefined) return null;
  const byClub = liveTotalsByClub(orders);
  return { totalCzk: [...byClub.values()].reduce((sum, v) => sum + v, 0), byClub };
}
