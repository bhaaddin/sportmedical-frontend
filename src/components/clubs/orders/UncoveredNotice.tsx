/*
 * Etapa 10: "Bez termínu: Spiroergometrie" - činnosti of a club order with players that no window of the order
 * allows. Information only (confirming is allowed anyway); the order card and the order detail show it under the terms.
 */
import { Alert } from '@mui/material';
import type { ClubOrderView } from '../../../api/clubOrders';
import { namesOf } from '../order/routing';
import { routedActivities } from './orderWindows';

/** The names of the činnosti that have no window; empty when there is nothing to warn about. */
export function uncoveredNames(order: Pick<ClubOrderView, 'status' | 'activitySeats' | 'requestedRanges'> & { uncoveredActivityIds?: string[] }): string[] {
  const live = order.status === 'Confirmed' || (order.status === 'Requested' && order.requestedRanges.length > 0);
  const ids = order.uncoveredActivityIds ?? [];
  return live && ids.length > 0 ? namesOf(ids, routedActivities(order)) : [];
}

export function UncoveredNotice({ order, compact = false }: { order: Parameters<typeof uncoveredNames>[0]; compact?: boolean }) {
  const names = uncoveredNames(order);
  if (names.length === 0) return null;
  return (
    <Alert severity="warning" data-testid="order-uncovered" sx={{ mt: compact ? 0.75 : 1, py: 0.25 }}>
      {`Bez termínu: ${names.join(', ')}`}
    </Alert>
  );
}

export default UncoveredNotice;
