/*
 * Reads from the data source, driven by the store's visible range, and hands
 * the UI one `PlannerContext` for the pure model plus explicit
 * loading / error states.
 *
 *   const m = usePlannerModel();
 *   if (m.status === 'loading') …   if (m.status === 'error') … m.error / m.refetch()
 *   m.ctx   // PlannerContext - pass it to the functions of '../model'
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePlannerData } from '../data/PlannerDataProvider';
import {
  buildPlannerContext,
  mergeSessions,
  plannerKeys,
  type PlannerCatalogue,
} from '../data/PlannerDataSource';
import type { ClubProfile, DayBudget, DayMark, PlannerContext, PlannerOrder } from '../model';
import { usePlannerSelector } from './PlannerStoreProvider';
import { selectVisibleRange } from './selectors';

export type PlannerModelStatus = 'loading' | 'error' | 'ready';

export interface PlannerModel {
  status: PlannerModelStatus;
  /** The first failure among the required reads, if any. */
  error: Error | null;
  /** Re-run every failed / stale read. */
  refetch: () => void;
  /** True while a re-read runs behind already shown data. */
  fetching: boolean;
  ctx: PlannerContext | null;
  catalogue: PlannerCatalogue | null;
  order: PlannerOrder | null;
  profile: ClubProfile | null;
  dayBudget: DayBudget | null;
  /** Day marks of the visible range keyed by day; empty when they failed (non-fatal). */
  dayMarks: Record<string, DayMark>;
  today: string;
}

export function usePlannerModel(): PlannerModel {
  const { source, today } = usePlannerData();
  const calendarMonth = usePlannerSelector((s) => s.calendarMonth);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const range = useMemo(() => selectVisibleRange({ calendarMonth, weekStart }), [calendarMonth, weekStart]);
  const sid = source.id;

  const catalogue = useQuery({ queryKey: plannerKeys.catalogue(sid), queryFn: () => source.getCatalogue() });
  const order = useQuery({ queryKey: plannerKeys.order(sid), queryFn: () => source.getOrder() });
  const profile = useQuery({ queryKey: plannerKeys.profile(sid), queryFn: () => source.getClubProfile() });
  const budget = useQuery({ queryKey: plannerKeys.dayBudget(sid), queryFn: () => source.getDayBudget() });
  const sessions = useQuery({
    queryKey: plannerKeys.sessions(sid, range),
    queryFn: () => source.listSessions(range),
    placeholderData: keepPreviousData,
  });
  const orderSessions = useQuery({ queryKey: plannerKeys.orderSessions(sid), queryFn: () => source.listOrderSessions() });
  const marks = useQuery({
    queryKey: plannerKeys.dayMarks(sid, range),
    queryFn: () => source.listDayMarks(range),
    placeholderData: keepPreviousData,
  });

  const required = [catalogue, order, profile, budget, sessions, orderSessions];
  const failed = required.find((q) => q.isError);
  const pending = required.some((q) => q.data === undefined);
  const status: PlannerModelStatus = failed && failed.data === undefined ? 'error' : pending ? 'loading' : 'ready';

  const dayMarks = useMemo(() => {
    const out: Record<string, DayMark> = {};
    for (const m of marks.data ?? []) out[m.date] = m;
    return out;
  }, [marks.data]);

  /* A real source's days carry the clinic's hours and lunch break: no term may touch the break (`openTime.ts`). The
     demo's marks are only decoration for the lab, so its terms are not held to them. */
  const enforceHours = catalogue.data?.capabilities.realPublish === true;
  const ctx = useMemo<PlannerContext | null>(() => {
    if (!catalogue.data || !order.data || !budget.data || !sessions.data || !orderSessions.data) return null;
    return buildPlannerContext({
      catalogue: catalogue.data,
      order: order.data,
      sessions: mergeSessions(sessions.data, orderSessions.data),
      dayBudget: budget.data,
      today,
      ...(enforceHours ? { dayMarks } : {}),
    });
  }, [catalogue.data, order.data, budget.data, sessions.data, orderSessions.data, today, enforceHours, dayMarks]);

  return {
    status,
    error: failed?.error instanceof Error ? failed.error : failed ? new Error('Načtení plánovače se nezdařilo.') : null,
    refetch: () => {
      for (const q of required) if (q.isError || q.isStale) void q.refetch();
      void marks.refetch();
    },
    fetching: required.some((q) => q.isFetching),
    ctx,
    catalogue: catalogue.data ?? null,
    order: order.data ?? null,
    profile: profile.data ?? null,
    dayBudget: budget.data ?? null,
    dayMarks,
    today,
  };
}
