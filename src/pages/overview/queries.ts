/*
 * The two reads Přehled starts from, as option objects, so the screen (Dashboard.tsx) and the warm start
 * (api/warmReads.ts) use the very same keys, functions and freshness and cannot drift apart.
 */
import { appointmentsApi } from '../../api/appointments';
import { clubOrdersApi } from '../../api/clubOrders';

/** ONE request for the Prague week: it answers Dnes (today's rows) and Tento týden (the seven bars). */
export const overviewWeekQuery = (from: string, to: string) => ({
  queryKey: ['overview', 'week', from] as const,
  queryFn: () => appointmentsApi.range(from, to),
  staleTime: 30_000,
});

/** The same list the attention model reads (same key: asked once). */
export const overviewClubOrdersQuery = () => ({
  queryKey: ['shelf', 'club-orders', 'Requested'] as const,
  queryFn: () => clubOrdersApi.list({ status: 'Requested' }),
  staleTime: 60_000,
});
