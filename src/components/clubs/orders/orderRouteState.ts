/* Router state that /clubs and /clubs/objednavky accept from the calendar and other screens. */

export interface NewOrderPrefill {
  clubId?: string;
}

export interface OrderRouteState {
  /** Open that order's detail. */
  openOrderId?: string;
  /** Open the "Nová klubová objednávka" chooser (phone order in the calendar / link for the club); `true` = no club yet. */
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
