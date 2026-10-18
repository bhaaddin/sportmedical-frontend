/*
 * The club's OLDER reservation material the planner dialog still has to reach: the bulk reservation without a club order
 * (a partner order of any calendar) and the window blocks that belong to no order. The same reads the clubs list makes
 * (`['calendars']`, `['partner-orders', calendarId]`, `['club-blocks', 'list']`), folded by the same `buildClubRow`.
 * Only read while the overview dialog is open.
 */
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { calendarsApi } from '../../api/calendars';
import { clubBlocksApi } from '../../api/clubBlocks';
import type { Club } from '../../api/clubs';
import { partnerOrdersApi } from '../../api/partnerOrders';
import { buildClubRow, type ClubRow } from '../../pages/clubs/clubRow';

export function useClubLegacy(club: Club, today: string): { row: ClubRow; loading: boolean } {
  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const orderQueries = useQueries({
    queries: calendars.map((c) => ({ queryKey: ['partner-orders', c.id], queryFn: () => partnerOrdersApi.list(c.id) })),
  });
  const blocksQuery = useQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list(), placeholderData: keepPreviousData });
  const orders = useMemo(() => orderQueries.flatMap((q) => q.data ?? []), [orderQueries]);
  const row = useMemo(() => buildClubRow(club, orders, blocksQuery.data ?? [], today), [club, orders, blocksQuery.data, today]);
  return { row, loading: calendarsQuery.isLoading || blocksQuery.isLoading || orderQueries.some((q) => q.isLoading) };
}
