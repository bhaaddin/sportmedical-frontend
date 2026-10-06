/*
 * What the desk tells the calendar before it starts picking times for a phone order: which club, which služba,
 * which činnosti with how many players. The calendar's "výběr termínů" works from this and nothing else.
 */
import type { OrderRange, PaymentMethod } from '../../../api/clubOrders';
import type { CoverageActivity } from './coverage';

export interface PickSession {
  clubId: string;
  clubName: string;
  serviceId: string;
  serviceName: string;
  activities: CoverageActivity[];
  paymentMethod: PaymentMethod;
  note: string;
  /** Etapa 5: set when this order is an addendum to another one (same group, same invoice). */
  parentOrderId?: string;
  /** Set when the terms of an EXISTING order are edited ('edit') or a club's request is processed ('process'). */
  editOrder?: EditOrderRef;
}

export interface EditOrderRef {
  mode: 'edit' | 'process';
  orderId: string;
  /** Process only: the seats, payment or note were changed in the dialog, so they are saved before confirming. */
  dirty: boolean;
  /** Process only: what the club asked for, shown as a hint ("Klub žádá: ..."). */
  requested: string[];
  /**
   * Edit only: the činnosti the order has RIGHT NOW (saved), set when the caller changed the numbers (`Přidat hráče`).
   * The calculator then shows only the additional need: the added players' slots against the time picked beyond
   * what the saved order needed.
   */
  baseline?: CoverageActivity[];
  /** Edit only: the order's live blocks; the picks start as these windows and they do not collide with themselves. */
  blocks: EditBlockRef[];
  /** The first day of the hint, so the calendar opens there. */
  firstDate: string | null;
}

export interface EditBlockRef {
  id: string;
  calendarId: string;
  range: OrderRange;
}


/** The order an addendum is added to; the setup form locks the club and the payment to it. */
export interface PickParent {
  orderId: string;
  clubId: string;
  clubName: string;
  paymentMethod: PaymentMethod | null;
}

/** Router state that starts the setup form on the calendar (from Kluby, a club's card). */
export interface PickOrderRouteState {
  clubId?: string;
  parent?: PickParent;
  /** Edit / process an existing order: straight to picking, no setup form. */
  start?: PickSession;
}

export function readPickOrderState(state: unknown): PickOrderRouteState | null {
  if (state === null || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>).pickOrder;
  if (raw === true) return {};
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: PickOrderRouteState = {};
  if (typeof r.clubId === 'string' && r.clubId !== '') out.clubId = r.clubId;
  const st = r.start;
  if (st !== null && typeof st === 'object' && typeof (st as Record<string, unknown>).clubId === 'string' && Array.isArray((st as Record<string, unknown>).activities)) {
    out.start = st as PickSession;
  }
  const p = r.parent;
  if (p !== null && typeof p === 'object') {
    const x = p as Record<string, unknown>;
    if (typeof x.orderId === 'string' && x.orderId !== '') {
      out.parent = {
        orderId: x.orderId,
        clubId: typeof x.clubId === 'string' ? x.clubId : (out.clubId ?? ''),
        clubName: typeof x.clubName === 'string' ? x.clubName : '',
        paymentMethod: x.paymentMethod === 'ClubInvoice' || x.paymentMethod === 'PerPerson' ? x.paymentMethod : null,
      };
      out.clubId = out.parent.clubId !== '' ? out.parent.clubId : out.clubId;
    }
  }
  return out;
}
