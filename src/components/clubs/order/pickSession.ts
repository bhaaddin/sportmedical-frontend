/*
 * What the desk tells the calendar before it starts picking times for a phone order: which club, which služba,
 * which činnosti with how many players. The calendar's "výběr termínů" works from this and nothing else.
 */
import type { PaymentMethod } from '../../../api/clubOrders';
import type { CoverageActivity } from './coverage';

export interface PickSession {
  clubId: string;
  clubName: string;
  serviceId: string;
  serviceName: string;
  activities: CoverageActivity[];
  paymentMethod: PaymentMethod;
  note: string;
}

/** Router state that starts the setup form on the calendar (from Kluby, a club's card). */
export interface PickOrderRouteState {
  clubId?: string;
}

export function readPickOrderState(state: unknown): PickOrderRouteState | null {
  if (state === null || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>).pickOrder;
  if (raw === true) return {};
  if (raw === null || typeof raw !== 'object') return null;
  const clubId = (raw as Record<string, unknown>).clubId;
  return typeof clubId === 'string' && clubId !== '' ? { clubId } : {};
}
