/*
 * Hooks that put the real data source on screen.
 *
 *   useApiDataSource({ session })      one `ApiDataSource` on the application's QueryClient (shared cache keys)
 *   useLabOrderSession(params, state)  where the order being planned comes from, the way the calendar gets it:
 *                                        - router state `{ pickOrder: { start: PickSession } }` (Kluby / Objednávky)
 *                                        - `?order=<id>`            edit the terms of an existing order
 *                                        - `?club=<id>&service=<id>&seats=<activityId>:<n>,...`   a new order
 *                                        - nothing                  standard booking
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { clinicServicesApi } from '../../api/clinicServices';
import { fetchBlockableActivities } from '../../api/clubBlocks';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { clubsApi } from '../../api/clubs';
import { editSessionFor, coverageActivity } from '../../components/clubs/order/editSession';
import { readPickOrderState, type PickSession } from '../../components/clubs/order/pickSession';
import { orderFromLists, orderKey, orderReadState } from '../club/clubStageReads';
import { ApiDataSource, type ApiDataSourceOptions } from '../data/ApiDataSource';
import { plannerKeys } from '../data/PlannerDataSource';
import { defaultApiDeps, type ApiDeps } from './deps';
import { usePlannerLive } from './usePlannerLive';

export interface UseApiDataSourceOptions extends Omit<ApiDataSourceOptions, 'deps'> {
  /** Replace the application's clients (tests). */
  deps?: ApiDataSourceOptions['deps'];
}

export function useApiDataSource(options: UseApiDataSourceOptions = {}): ApiDataSource {
  const queryClient = useQueryClient();
  /* Bumped when the order's own read disagrees with the shared copy the source started from: a new source, real data. */
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([
    options.session ?? null,
    options.calendarIds ?? null,
    options.newCalendarIds ?? null,
    options.today ?? null,
    options.clubContext ?? null,
    options.id ?? null,
  ]);
  const orderId = options.session?.editOrder?.orderId ?? null;
  const source = useMemo(() => {
    const base = options.deps ?? defaultApiDeps(queryClient);
    const deps = options.deps !== undefined || orderId === null ? base : startFromShared(base, queryClient, orderId, () => setRevision((r) => r + 1));
    return new ApiDataSource({ ...options, deps });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the source is rebuilt only when what it plans changes
  }, [queryClient, key, revision]);
  /* After a rebuild the planner's reads of this source are asked again (from the new source: the child has rendered). */
  useEffect(() => {
    if (revision > 0) void queryClient.invalidateQueries({ queryKey: plannerKeys.all(source.id) });
  }, [queryClient, revision, source.id]);
  usePlannerLive(source);
  return source;
}

/** Whether the single read says something the stage would draw differently (the list leaves `history` out). */
export function differsForStage(shared: ClubOrderView, fresh: ClubOrderView): boolean {
  return JSON.stringify({ ...shared, history: null }) !== JSON.stringify({ ...fresh, history: null });
}

/**
 * The deps a source STARTS from: its first read of the order it plans does not wait for `club-orders/{id}` when the
 * answer is already here -
 *   - a current answer of that very read (the club screen started it beside its other reads): taken as it is;
 *   - else the order's row in a current list of orders (the club screen has just read them; the row carries what the
 *     single read returns except `history`, which the stage does not use): taken, and the single read runs behind it
 *     (or keeps running, if it is already on its way). Should it answer anything the stage draws differently,
 *     `onDiffers` rebuilds the source, which then starts from that real answer;
 *   - else the single read, as always (the fallback).
 * Every later read of the order (after a save) is the plain single read.
 */
export function startFromShared(base: ApiDeps, queryClient: QueryClient, orderId: string, onDiffers: () => void): ApiDeps {
  let first = true;
  return {
    ...base,
    order: (id) => {
      if (!first || id !== orderId) return base.order(id);
      first = false;
      if (orderReadState(queryClient, id) === 'current') {
        const current = queryClient.getQueryData<ClubOrderView>(orderKey(id));
        if (current !== undefined) return Promise.resolve(current);
      }
      const shared = orderFromLists(queryClient, id);
      if (shared === undefined) return base.order(id);
      void base.order(id).then(
        (fresh) => {
          if (differsForStage(shared, fresh)) onDiffers();
        },
        () => undefined,
      );
      return Promise.resolve(shared);
    },
  };
}

/** `actId:3,actId2:10` -> [{ activityId, seats }]; anything malformed is dropped. */
export function parseSeats(raw: string | null): { activityId: string; seats: number }[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.split(':'))
    .flatMap(([id, n]) => {
      const seats = Number(n);
      return id && Number.isInteger(seats) && seats > 0 ? [{ activityId: id, seats }] : [];
    });
}

export type LabSessionState =
  | { status: 'standard' }
  | { status: 'loading' }
  | { status: 'ready'; session: PickSession }
  | { status: 'error'; message: string };

export function useLabOrderSession(params: URLSearchParams, routerState: unknown, today: string, enabled: boolean): LabSessionState {
  const fromState = enabled ? readPickOrderState(routerState)?.start : undefined;
  const orderId = enabled ? params.get('order') : null;
  const clubId = enabled ? params.get('club') : null;
  const serviceId = params.get('service');
  const seats = params.get('seats');

  const query = useQuery({
    queryKey: ['planner', 'api', 'lab-session', orderId, clubId, serviceId, seats],
    enabled: enabled && fromState === undefined && (orderId !== null || clubId !== null),
    retry: false,
    staleTime: 0,
    queryFn: async (): Promise<PickSession> => {
      const catalogue = await fetchBlockableActivities();
      if (orderId) {
        const order = await clubOrdersApi.get(orderId);
        return editSessionFor(order, catalogue, today);
      }
      const [club, services] = await Promise.all([clubsApi.getById(clubId as string), clinicServicesApi.list()]);
      const service = services.find((s) => s.id === serviceId) ?? services[0];
      const wanted = parseSeats(seats);
      const activities = wanted.flatMap((w) => {
        const known = catalogue.find((a) => a.id === w.activityId);
        return known ? [coverageActivity({ activityId: known.id, activityName: known.name, durationMinutes: known.durationMinutes, seats: w.seats }, catalogue)] : [];
      });
      return {
        clubId: club.id,
        clubName: club.name,
        serviceId: service?.id ?? '',
        serviceName: service?.name ?? '',
        activities,
        paymentMethod: 'ClubInvoice',
        note: '',
      };
    },
  });

  return useMemo<LabSessionState>(() => {
    if (!enabled) return { status: 'standard' };
    if (fromState !== undefined) return { status: 'ready', session: fromState };
    if (orderId === null && clubId === null) return { status: 'standard' };
    if (query.isError) return { status: 'error', message: query.error instanceof Error ? query.error.message : 'Objednávku se nepodařilo načíst.' };
    if (query.data) return { status: 'ready', session: query.data };
    return { status: 'loading' };
  }, [enabled, fromState, orderId, clubId, query.isError, query.error, query.data]);
}
