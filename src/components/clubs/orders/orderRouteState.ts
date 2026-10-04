/* Router state that /clubs and /clubs/objednavky accept from the calendar and other screens. */
import type { OrderRange } from '../../../api/clubOrders';

export interface NewOrderPrefill {
  clubId?: string;
  serviceId?: string;
  ranges?: OrderRange[];
  calendarIds?: string[];
}

export interface OrderRouteState {
  /** Open that order's detail. */
  openOrderId?: string;
  /** Open the order dialog, prefilled; `true` = empty. */
  newOrder?: NewOrderPrefill | true;
}

export function readOrderState(state: unknown): OrderRouteState {
  if (state === null || typeof state !== 'object') return {};
  const s = state as Record<string, unknown>;
  const out: OrderRouteState = {};
  if (typeof s.openOrderId === 'string' && s.openOrderId !== '') out.openOrderId = s.openOrderId;
  if (s.newOrder === true) out.newOrder = true;
  else if (s.newOrder !== null && typeof s.newOrder === 'object') out.newOrder = s.newOrder as NewOrderPrefill;
  return out;
}

export const hasOrderState = (s: OrderRouteState): boolean => s.openOrderId !== undefined || s.newOrder !== undefined;
