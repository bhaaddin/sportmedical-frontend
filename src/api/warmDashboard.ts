/*
 * What Přehled starts from, begun before its code has arrived (speed-fe-4). Its own module, loaded only for the /prehled address:
 * the planner imports warmReads.ts statically and must not carry the overview's model. The reads use the very same keys,
 * functions and freshness as the screen (pages/overview/queries.ts).
 */
import type { QueryClient } from '@tanstack/react-query';
import { weekRange } from '../pages/overview/model';
import { overviewClubOrdersQuery, overviewWeekQuery } from '../pages/overview/queries';

const warm = (promise: Promise<unknown>): void => void promise.catch(() => undefined);

export function warmDashboard(queryClient: QueryClient, now = new Date()): void {
  const { from, to } = weekRange(now);
  warm(queryClient.prefetchQuery(overviewWeekQuery(from, to)));
  warm(queryClient.prefetchQuery(overviewClubOrdersQuery()));
}
