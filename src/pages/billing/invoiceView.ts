/*
 * What the Fakturace screen says about an invoice, with no React in it so each
 * rule can be broken in a test and seen to fail.
 *
 * The server's InvoiceStatus is Draft / Issued / PartiallyPaid / Paid /
 * Refunded / Cancelled. The board shows the desk four words - Zaplaceno,
 * Vystaveno, Nezaplaceno, Po splatnosti - and "po splatnosti" is not a status
 * the server stores; it is an open invoice whose due date has passed, so it is
 * worked out here from `dueDateUtc` against the clock the caller passes in.
 */
import type { Invoice, InvoicePaymentMethod } from '../../api/billing';
import type { ChipTone } from '../../components/ui';

export type InvoiceFilter = 'all' | 'unpaid' | 'overdue' | 'clubs';

/** Still collectable: issued or partly paid, with money outstanding. */
export function isOpen(inv: Invoice): boolean {
  return (inv.status === 'Issued' || inv.status === 'PartiallyPaid') && inv.remainingCzk > 0;
}

export function isOverdue(inv: Invoice, now: Date): boolean {
  if (!isOpen(inv)) return false;
  const due = new Date(inv.dueDateUtc).getTime();
  return Number.isFinite(due) && due < now.getTime();
}

/** Billed to a club rather than a patient - only once the API says so. */
export function isClub(inv: Invoice): boolean {
  return Boolean(inv.clubId) || Boolean(inv.clubName);
}

/** Counts towards turnover: issued and not taken back. */
function counts(inv: Invoice): boolean {
  return inv.status === 'Issued' || inv.status === 'PartiallyPaid' || inv.status === 'Paid';
}

function sameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export interface InvoiceStatusView {
  label: string;
  tone: ChipTone;
}

/*
 * On the board a patient's unpaid invoice reads "Nezaplaceno" (he should have
 * paid at the desk) while a club's reads "Vystaveno" (sent, a transfer is on
 * its way). Past the due date both turn into "Po splatnosti".
 */
export function statusOf(inv: Invoice, now: Date): InvoiceStatusView {
  if (isOverdue(inv, now)) return { label: 'Po splatnosti', tone: 'red' };
  switch (inv.status) {
    case 'Paid':
      return { label: 'Zaplaceno', tone: 'green' };
    case 'Issued':
      return isClub(inv) ? { label: 'Vystaveno', tone: 'beige' } : { label: 'Nezaplaceno', tone: 'red' };
    case 'PartiallyPaid':
      return { label: 'Částečně zaplaceno', tone: 'beige' };
    case 'Draft':
      return { label: 'Návrh', tone: 'grey' };
    case 'Refunded':
      return { label: 'Vráceno', tone: 'grey' };
    case 'Cancelled':
      return { label: 'Zrušeno', tone: 'grey' };
    default:
      return { label: inv.status, tone: 'grey' };
  }
}

/** "Komplexní prohlídka · 12× Základní prohlídka" - the lines, in order. */
export function itemsLabel(inv: Invoice): string {
  const items = inv.items ?? [];
  if (items.length === 0) return '—';
  return items
    .map((it) => (it.quantity > 1 ? `${it.quantity}× ${it.description}` : it.description))
    .join(' · ');
}

/** Who the invoice is for, as the search box sees it. */
export function customerOf(inv: Invoice): string {
  return (isClub(inv) ? inv.clubName : null) || inv.patientName || '';
}

export function matchesSearch(inv: Invoice, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    (inv.invoiceNumber ?? '').toLowerCase().includes(q) ||
    (inv.patientName ?? '').toLowerCase().includes(q) ||
    (inv.clubName ?? '').toLowerCase().includes(q) ||
    itemsLabel(inv).toLowerCase().includes(q)
  );
}

export function matchesFilter(inv: Invoice, filter: InvoiceFilter, now: Date): boolean {
  switch (filter) {
    case 'unpaid':
      return isOpen(inv);
    case 'overdue':
      return isOverdue(inv, now);
    case 'clubs':
      return isClub(inv);
    default:
      return true;
  }
}

export interface InvoiceSummary {
  /** Turnover of the current month and how many invoices made it. */
  invoicedThisMonth: number;
  invoicedThisMonthCount: number;
  /** Everything still outstanding, whatever month it is from. */
  unpaid: number;
  overdueCount: number;
  /** This month's turnover per distinct patient, or null when nothing was billed. */
  averagePerPatient: number | null;
  /** Money taken this month at the desk: in cash, and by card. */
  cashThisMonth: number;
  cardThisMonth: number;
}

/**
 * What came in this month in one way. Read off the payments when the invoice
 * lists them (so a payment made today on an old invoice counts today); an
 * invoice that only carries the per-method totals counts them in the month it
 * was issued.
 */
function paidThisMonth(inv: Invoice, method: InvoicePaymentMethod, now: Date): number {
  if (inv.status === 'Cancelled' || inv.status === 'Refunded') return 0;
  if (inv.payments !== undefined && inv.payments.length > 0) {
    return inv.payments
      .filter((p) => p.method === method && sameMonth(p.paidAtUtc, now))
      .reduce((sum, p) => sum + p.amountCzk, 0);
  }
  if (!sameMonth(inv.issueDateUtc, now)) return 0;
  switch (method) {
    case 'Cash': return inv.cashPaidCzk ?? 0;
    case 'Card': return inv.cardPaidCzk ?? 0;
    case 'Transfer': return inv.transferPaidCzk ?? 0;
    default: return inv.clubPaidCzk ?? 0;
  }
}

export function summarize(invoices: Invoice[], now: Date): InvoiceSummary {
  const thisMonth = invoices.filter((i) => counts(i) && sameMonth(i.issueDateUtc, now));
  const invoicedThisMonth = thisMonth.reduce((s, i) => s + i.totalCzk, 0);
  const patients = new Set(thisMonth.map((i) => i.patientId));

  const open = invoices.filter(isOpen);
  return {
    invoicedThisMonth,
    invoicedThisMonthCount: thisMonth.length,
    unpaid: open.reduce((s, i) => s + i.remainingCzk, 0),
    overdueCount: invoices.filter((i) => isOverdue(i, now)).length,
    averagePerPatient: patients.size === 0 ? null : Math.round(invoicedThisMonth / patients.size),
    cashThisMonth: invoices.reduce((sum, i) => sum + paidThisMonth(i, 'Cash', now), 0),
    cardThisMonth: invoices.reduce((sum, i) => sum + paidThisMonth(i, 'Card', now), 0),
  };
}

/* Czech months in the locative, for "VYFAKTUROVÁNO V ŘÍJNU". Intl only has
   the nominative. Language, not clinic configuration. */
const MONTH_IN = [
  'v lednu', 'v únoru', 'v březnu', 'v dubnu', 'v květnu', 'v červnu',
  'v červenci', 'v srpnu', 'v září', 'v říjnu', 'v listopadu', 'v prosinci',
];

export function monthIn(now: Date): string {
  return MONTH_IN[now.getMonth()];
}

/** "říjen 2026" */
export function monthYear(now: Date): string {
  return now.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

/** How a payment is called on the screen. */
export const PAYMENT_METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  Cash: 'Hotově',
  Card: 'Kartou',
  Transfer: 'Převodem',
  ClubBilling: 'Na klub',
};

/** Czech plural for "doklad": 1 doklad, 2–4 doklady, 5+ dokladů. */
export function doklady(n: number): string {
  if (n === 1) return '1 doklad';
  if (n >= 2 && n <= 4) return `${n} doklady`;
  return `${n} dokladů`;
}
