/*
 * What a club's planner screen (`/clubs/:clubId`) reads: the club, its orders folded into groups, the group in view and
 * - when that group can be edited - the `PickSession` that puts it on the stage. The same API clients and query keys
 * the old club page used (`['club-orders', clubId, '', '']`), so every order change refreshes both.
 *
 * It decides nothing about planning itself: the session is `editSessionFor(root)` exactly as the old "Upravit termíny"
 * built it; a club without an order (or a group that is not Confirmed) gives no session and the stage runs in the
 * club's context only (`ApiDataSource.clubContext`).
 *
 * Speed (see `planner/club/clubStageReads.ts`): on entry every read of the screen starts at once (`prefetchClubScreen`,
 * a no-op for what the club list's card already warmed), and the moment the orders are known the stage's own reads
 * start too - while the catalogue, the code and the first draw are still on their way - instead of one after the other
 * once the stage has drawn.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { clubBlocksApi, fetchBlockableActivities, type ClubBlockView } from '../../api/clubBlocks';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { clubsApi, type Club } from '../../api/clubs';
import { prefetchClubScreen } from '../../api/warmReads';
import { editSessionFor } from '../../components/clubs/order/editSession';
import type { PickSession } from '../../components/clubs/order/pickSession';
import type { ClubGroup } from './clubGroups';
import { clubSelection, prefetchClubStage } from './clubStageReads';

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
  /** `session`: a session the router state hands over (it replaces the group's own on the stage). */
  wanted: { orderId: string | null; blockId: string | null; session?: PickSession | null },
): ClubPlannerData {
  const queryClient = useQueryClient();
  /* Route entry: everything the screen reads starts now, in one wave (what is already fresh asks nothing). Before the
     queries below mount, so a copy shared from the club list is in place when they look. */
  useMemo(() => prefetchClubScreen(queryClient, clubId, { stage: false }), [queryClient, clubId]);

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
  const blocks = useMemo(() => (blocksQuery.data ?? []).filter((b) => b.clubId === clubId), [blocksQuery.data, clubId]);

  /* Which group is in view and the day the board opens on (a window the caller names picks the group that owns it). */
  const routed = wanted.session ?? null;
  const selection = useMemo(
    () => clubSelection(orders, blocks, today, { orderId: wanted.orderId, blockId: wanted.blockId, session: routed }),
    [orders, blocks, today, wanted.orderId, wanted.blockId, routed],
  );
  const { groups, selected, openOn } = selection;

  /* The stage's reads, as soon as the orders are known (once per distinct start; the cache keeps it from asking twice). */
  const ordersKnown = ordersQuery.data !== undefined;
  const startKey = ordersKnown ? JSON.stringify([clubId, selection.start.openOn, selection.start.session?.serviceId ?? null, selection.start.session?.order?.id ?? null, selection.start.session?.order?.blocks ?? null]) : null;
  const start = selection.start;
  useEffect(() => {
    if (startKey === null) return;
    void prefetchClubStage(queryClient, start).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `startKey` is what of `start` the reads depend on
  }, [queryClient, startKey]);

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
