/*
 * A colour changed (a činnost's own, a služba's, the palette): every screen that draws a činnost refreshes at once, so the board,
 * the club windows, the mini calendar, the lists and the legends agree without a reload (reviewer 2.6: "consistent everywhere").
 * Invalidation only marks the reads stale and refetches the ones on screen; nothing remounts.
 */
import type { QueryClient } from '@tanstack/react-query';

/** The first element of every query key that carries a colour of a činnost or a služba. */
export const COLOR_KEYS = [
  'activities',
  'activity',
  'clinic-services',
  'club-block-activities',
  'calendars',
  'settings',
  /* the planner reads the catalogue through `['planner', sourceId, ...]` */
  'planner',
  /* what the calendar draws from them */
  'day-range',
  'club-blocks',
  'blocks',
] as const;

export function invalidateColorCaches(queryClient: QueryClient): Promise<void> {
  return Promise.all(COLOR_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))).then(() => undefined);
}
