/*
 * ONE refresh for everything a club-order change can touch, so the calendar, the club page and the order detail
 * agree at once without a manual reload. Every club/order mutation (create, update, confirm, cancel, remove window,
 * change players, offered days, invoice, pick-mode confirm) calls this instead of listing its own keys.
 *
 * Invalidation only marks the queries stale and refetches the ones on screen; screens keep showing their previous
 * data while it happens (`placeholderData: keepPreviousData` / the cached value), so nothing remounts or jumps.
 */
import type { QueryClient } from '@tanstack/react-query';

/** The first element of every query key a club order change can affect. */
export const CLUB_WORLD_KEYS = [
  /* the order and its screens */
  'club-order',
  'club-orders',
  'club-order-invoice-draft',
  'club-order-services',
  'club-summary',
  'club-stats',
  'club-billing',
  'club-reservations',
  'club-players',
  'clubs',
  'partner-orders',
  'service-usage',
  /* the windows (club blocks) and what the calendar draws from them */
  'club-blocks',
  'blocks',
  'day-range',
  'day-summary',
  'grid-preview',
  'overview-preview',
  'preview',
  'availability',
  'pick-jump',
] as const;

export function invalidateClubWorld(queryClient: QueryClient): Promise<void> {
  return Promise.all(CLUB_WORLD_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))).then(() => undefined);
}
