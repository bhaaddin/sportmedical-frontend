/*
 * What a club's planner screen (`/clubs/:clubId`) reads: the club, its orders folded into groups, the group in view and
 * - when that group can be edited - the `PickSession` that puts it on the stage. The same API clients and query keys
 * the old club page used (`['club-orders', clubId, '', '']`), so every order change refreshes both.
 *
 * It decides nothing about planning itself: the session is `editSessionFor(root)` exactly as the old "Upravit termíny"
 * built it; a club without an order (or a group that is not Confirmed) gives no session and the stage runs in the
 * club's context only (`ApiDataSource.clubContext`).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { clubBlocksApi, fetchBlockableActivities, type ClubBlockView } from '../../api/clubBlocks';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { clubsApi, type Club } from '../../api/clubs';
import { editSessionFor } from '../../components/clubs/order/editSession';
import type { PickSession } from '../../components/clubs/order/pickSession';
import { clubGroups, openingDate, selectedGroup, type ClubGroup } from './clubGroups';

export type ClubPlannerStatus = 'loading' | 'error' | 'notFound' | 'ready';

export interface ClubPlannerData {
  status: ClubPlannerStatus;
  club: Club | null;
  /** Every order of the club, cancelled ones too. */
  orders: ClubOrderView[];
  /** The orders could not be read: the screen opens in the club's context with a note. */
  ordersFailed: boolean;
  groups: ClubGroup[];
  /** The group in view; null for a club without a live order. */
  selected: ClubGroup | null;
  /** The selected group on the stage (null: not editable now). */
  session: PickSession | null;
  /** The club's window blocks (every order's and the older ones without an order). */
  blocks: ClubBlockView[];
  /** The day the board opens on. */
  openOn: string;
  today: string;
  refetch: () => void;
}

export function useClubPlannerData(
  clubId: string,
  today: string,
  wanted: { orderId: string | null; blockId: string | null },
): ClubPlannerData {
  const clubQuery = useQuery({
    queryKey: ['clubs', 'one', clubId],
    queryFn: () => clubsApi.getById(clubId),
    retry: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['club-orders', clubId, '', ''],
    queryFn: () => clubOrdersApi.list({ clubId }),
    retry: false,
  });
  const blocksQuery = useQuery({
    queryKey: ['club-blocks', 'list'],
    queryFn: () => clubBlocksApi.list(),
    placeholderData: keepPreviousData,
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const groups = useMemo(() => clubGroups(orders, today), [orders, today]);
  const blocks = useMemo(() => (blocksQuery.data ?? []).filter((b) => b.clubId === clubId), [blocksQuery.data, clubId]);

  /* A window the caller names (the calendar's "Otevřít klub") picks the group that owns it. */
  const owner = useMemo(
    () => (wanted.blockId === null ? null : groups.find((g) => g.blockIds.includes(wanted.blockId as string)) ?? null),
    [groups, wanted.blockId],
  );
  const selected = useMemo(
    () => (wanted.orderId === null && owner !== null ? owner : selectedGroup(groups, wanted.orderId)),
    [groups, wanted.orderId, owner],
  );

  const needsCatalogue = selected?.editable === true;
  const catalogueQuery = useQuery({
    queryKey: ['club-block-activities'],
    queryFn: fetchBlockableActivities,
    staleTime: 5 * 60 * 1000,
    enabled: needsCatalogue,
  });

  const session = useMemo<PickSession | null>(
    () => (selected?.editable && catalogueQuery.data ? editSessionFor(selected.root, catalogueQuery.data, today) : null),
    [selected, catalogueQuery.data, today],
  );

  const blockDate = wanted.blockId === null
    ? null
    : (orders.flatMap((o) => o.blocks).find((b) => b.id === wanted.blockId) ?? blocks.find((b) => b.id === wanted.blockId))?.fromDate ?? null;
  const openOn = blockDate ?? session?.editOrder?.firstDate ?? openingDate(selected, groups, today);

  const failed = clubQuery.isError && clubQuery.data === undefined;
  const status: ClubPlannerStatus = failed
    ? (isNotFound(clubQuery.error) ? 'notFound' : 'error')
    : clubQuery.data === undefined || (ordersQuery.data === undefined && !ordersQuery.isError) || (needsCatalogue && catalogueQuery.data === undefined && !catalogueQuery.isError)
      ? 'loading'
      : 'ready';

  return {
    status,
    club: clubQuery.data ?? null,
    orders,
    ordersFailed: ordersQuery.isError,
    groups,
    selected,
    session,
    blocks,
    openOn,
    today,
    refetch: () => {
      void clubQuery.refetch();
      void ordersQuery.refetch();
    },
  };
}

function isNotFound(error: unknown): boolean {
  const status = (error as { status?: number; response?: { status?: number } } | null)?.status
    ?? (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404;
}
