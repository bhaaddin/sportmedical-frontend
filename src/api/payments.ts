/* ══════════════════════════════════════════════════════════════
   PAYMENTS API
   The payment ledger beside the invoices: a payment is one record with a
   method and a status; a transfer waits (Pending) until the money is seen.
   The backend (branch web/pay) may not be live yet - every read answers
   `null` / `[]` on a 404 or 403 (other failures are thrown), so a screen can hide the feature
   instead of failing. Provider-neutral: no online provider is chosen.
   ══════════════════════════════════════════════════════════════ */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import client from './client';

export type PaymentMethod = 'Cash' | 'Card' | 'Transfer' | 'ClubBilling' | 'Online';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Expired';
export type PaymentReviewReason = 'late_payment' | 'amount_mismatch' | 'invoice_not_payable';

export interface Payment {
  id: string;
  invoiceId?: string | null;
  appointmentId?: string | null;
  clubOrderId?: string | null;
  cashierTransactionId?: string | null;
  amountCzk: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider?: string | null;
  variableSymbol?: string | null;
  createdAtUtc: string;
  expiresAtUtc?: string | null;
  paidAtUtc?: string | null;
  refundedAmountCzk: number;
  netPaidCzk: number;
  failureCode?: string | null;
  needsReview: boolean;
  reviewReason?: PaymentReviewReason | null;
  reportedAmountCzk?: number | null;
  createdBy?: string | null;
}

export interface PaymentPage {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaymentFilter {
  status?: PaymentStatus;
  method?: PaymentMethod;
  needsReview?: boolean;
  invoiceId?: string;
  page?: number;
  pageSize?: number;
}

/** The QR payment of one invoice (a Czech "QR Platba"): what the patient scans or types in the bank. */
export interface PaymentQr {
  paymentId: string;
  spayd: string;
  iban: string;
  variableSymbol: string;
  amountCzk: number;
  dueDate?: string | null;
  message?: string | null;
  qrSvg?: string | null;
  qrPngBase64?: string | null;
}

export interface PaymentCreated {
  payment: Payment;
  initiation?: {
    redirectUrl?: string | null;
    spayd?: string | null;
    iban?: string | null;
    qrSvg?: string | null;
    qrPngBase64?: string | null;
  } | null;
  invoiceStatus?: string | null;
  invoicePaidCzk?: number | null;
  invoiceRemainingCzk?: number | null;
}

export interface Reconciliation {
  generatedAtUtc: string;
  invoicesChecked: number;
  drift: { invoiceId: string; invoiceNumber: string; invoicePaidCzk: number; ledgerPaidCzk: number }[];
  needsReviewCount: number;
  overduePendingCount: number;
}

export type AppointmentPaymentStatus = 'none' | 'unpaid' | 'partial' | 'paid';

export interface AppointmentPaymentState {
  appointmentId: string;
  invoiceId?: string | null;
  priceCzk?: number | null;
  paidCzk: number;
  dueCzk: number;
  status: AppointmentPaymentStatus;
  pendingPaymentId?: string | null;
  pendingMethod?: PaymentMethod | null;
  needsReview: boolean;
  canPayOnline: boolean;
  canPayByTransfer: boolean;
}

/** `{ success, message, data }` or a bare body - both are read. */
const unwrap = <T>(body: unknown): T => {
  const envelope = body as { data?: T } | null;
  return (envelope !== null && typeof envelope === 'object' && 'data' in envelope ? envelope.data : body) as T;
};

/** A read that answers `fallback` only when the endpoint is not there (404) or not allowed (403); any other failure (5xx, network, 401) is thrown so the query retries and keeps its last data. */
async function soft<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 404 || status === 403) return fallback;
    throw error;
  }
}

export const paymentsApi = {
  /** `null` = the payment ledger is not available here (not live yet, or no `payments.view`). */
  list: (filter: PaymentFilter = {}): Promise<PaymentPage | null> =>
    soft(async () => {
      const res = await client.get('/api/payments', { params: { ...filter, pageSize: filter.pageSize ?? 100 } });
      const page = unwrap<PaymentPage | null>(res.data);
      return page !== null && Array.isArray(page?.items) ? page : null;
    }, null),

  reconciliation: (): Promise<Reconciliation | null> =>
    soft(async () => unwrap<Reconciliation>((await client.get('/api/payments/reconciliation')).data) ?? null, null),

  forInvoice: (invoiceId: string): Promise<Payment[]> =>
    soft(async () => {
      const rows = unwrap<Payment[]>((await client.get(`/api/billing/invoices/${invoiceId}/payments`)).data);
      return Array.isArray(rows) ? rows : [];
    }, []),

  appointmentState: (appointmentId: string): Promise<AppointmentPaymentState | null> =>
    soft(async () => {
      const state = unwrap<AppointmentPaymentState>(
        (await client.get(`/api/billing/appointments/${appointmentId}/payment-state`)).data,
      );
      return state && typeof state.status === 'string' ? state : null;
    }, null),

  /** Throws: the caller shows the server's Czech sentence (no IBAN, nothing left to pay). */
  invoiceQr: async (invoiceId: string): Promise<PaymentQr> =>
    unwrap<PaymentQr>((await client.get(`/api/billing/invoices/${invoiceId}/payment-qr`)).data),

  confirm: async (id: string): Promise<PaymentCreated> =>
    unwrap<PaymentCreated>((await client.post(`/api/payments/${id}/confirm`, {})).data),

  cancel: async (id: string): Promise<PaymentCreated> =>
    unwrap<PaymentCreated>((await client.post(`/api/payments/${id}/cancel`, {})).data),

  refund: async (id: string, body: { amountCzk?: number; reason: string }): Promise<PaymentCreated> =>
    unwrap<PaymentCreated>((await client.post(`/api/payments/${id}/refund`, body)).data),
};

export const PAYMENTS_KEY = ['payments'] as const;

/** The list of payments; `data === null` once loaded means "hide the Platby screen". */
export function usePayments(filter: PaymentFilter, enabled = true) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'list', filter],
    queryFn: () => paymentsApi.list(filter),
    enabled,
    staleTime: 15_000,
  });
}

/** The ledger read page by page (server-side filter); `data.pages[0] === null` means "no ledger here". */
export function usePaymentsPaged(filter: Omit<PaymentFilter, 'page'>, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...PAYMENTS_KEY, 'paged', filter],
    queryFn: ({ pageParam }) => paymentsApi.list({ ...filter, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      if (last === null) return undefined;
      const loaded = all.reduce((n, p) => n + (p?.items.length ?? 0), 0);
      return loaded < last.total && last.items.length > 0 ? all.length + 1 : undefined;
    },
    enabled,
    staleTime: 15_000,
  });
}

export function usePaymentsReconciliation(enabled = true) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'reconciliation'],
    queryFn: paymentsApi.reconciliation,
    enabled,
    staleTime: 60_000,
  });
}

export function useAppointmentPaymentState(appointmentId: string | undefined) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'appointment', appointmentId],
    queryFn: () => paymentsApi.appointmentState(appointmentId as string),
    enabled: !!appointmentId,
    staleTime: 15_000,
  });
}

export function useInvoicePayments(invoiceId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'invoice', invoiceId],
    queryFn: () => paymentsApi.forInvoice(invoiceId),
    enabled,
    staleTime: 15_000,
  });
}
