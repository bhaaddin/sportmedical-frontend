/* Fakturace klubů: the Tým invoices, per-club totals and the confirmed orders that still wait for an invoice. Pure. */
import type { Invoice } from '../../../api/billing';
import type { ClubOrderView } from '../../../api/clubOrders';
import { isOpen, isClub, recipientTypeOf } from '../../billing/invoiceView';

export const teamInvoices = (invoices: readonly Invoice[]): Invoice[] =>
  invoices.filter((i) => recipientTypeOf(i) === 'Team' && isClub(i));

/** Money that was issued and not taken back. */
const issued = (i: Invoice): boolean => i.status === 'Issued' || i.status === 'PartiallyPaid' || i.status === 'Paid';

export interface ClubTotals {
  key: string;
  clubName: string;
  count: number;
  issuedCzk: number;
  paidCzk: number;
  unpaidCzk: number;
}

export function clubTotals(invoices: readonly Invoice[]): ClubTotals[] {
  const map = new Map<string, ClubTotals>();
  for (const i of invoices) {
    const key = i.clubId ?? i.clubName ?? i.recipientName ?? '';
    const name = i.clubName ?? i.recipientName ?? 'Neznámý klub';
    const row = map.get(key) ?? { key, clubName: name, count: 0, issuedCzk: 0, paidCzk: 0, unpaidCzk: 0 };
    row.count += 1;
    if (issued(i)) {
      row.issuedCzk += i.totalCzk;
      row.paidCzk += i.paidCzk;
      if (isOpen(i)) row.unpaidCzk += i.remainingCzk;
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.clubName.localeCompare(b.clubName, 'cs'));
}

/** The order an invoice was drawn up for, when the server says so (not yet part of the typed Invoice). */
export const invoiceOrderId = (i: Invoice): string | null => {
  const v = (i as { clubOrderId?: unknown }).clubOrderId;
  return typeof v === 'string' && v !== '' ? v : null;
};

/** Confirmed orders paid by a club invoice for which no invoice exists yet. */
export function ordersAwaitingInvoice(orders: readonly ClubOrderView[], invoices: readonly Invoice[]): ClubOrderView[] {
  const done = new Set(invoices.map(invoiceOrderId).filter((v): v is string => v !== null));
  /* Etapa 5: an addendum is invoiced with its group's root, and a group whose invoice exists does not wait. */
  return orders.filter((o) => o.status === 'Confirmed' && o.paymentMethod === 'ClubInvoice' && o.parentOrderId === null && o.invoiceId === null && !done.has(o.id));
}
