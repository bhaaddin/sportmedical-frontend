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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { clinicServicesApi } from '../../api/clinicServices';
import { fetchBlockableActivities } from '../../api/clubBlocks';
import { clubOrdersApi } from '../../api/clubOrders';
import { clubsApi } from '../../api/clubs';
import { editSessionFor, coverageActivity } from '../../components/clubs/order/editSession';
import { readPickOrderState, type PickSession } from '../../components/clubs/order/pickSession';
import { ApiDataSource, type ApiDataSourceOptions } from '../data/ApiDataSource';
import { defaultApiDeps } from './deps';

export interface UseApiDataSourceOptions extends Omit<ApiDataSourceOptions, 'deps'> {
  /** Replace the application's clients (tests). */
  deps?: ApiDataSourceOptions['deps'];
}

export function useApiDataSource(options: UseApiDataSourceOptions = {}): ApiDataSource {
  const queryClient = useQueryClient();
  const key = JSON.stringify([
    options.session ?? null,
    options.calendarIds ?? null,
    options.newCalendarIds ?? null,
    options.today ?? null,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the source is rebuilt only when what it plans changes
  return useMemo(() => new ApiDataSource({ ...options, deps: options.deps ?? defaultApiDeps(queryClient) }), [queryClient, key]);
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
