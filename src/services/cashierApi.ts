import client from '../api/client';

/**
 * Exactly the server's `PaymentMethod` (Domain/Billing/PaymentMethod.cs):
 * Cash 0, Card 1, Transfer 2, ClubBilling 3.
 *
 * Until wave 3 this file had club billing as 2 and transfer as 3 - the two
 * swapped - so "Na klub" was recorded as a bank transfer and "Převod" as a
 * club charge. The month's club invoice preview counted the wrong rows.
 */
export const PaymentMethod = {
  Cash: 0,
  Card: 1,
  Transfer: 2,
  ClubBilling: 3,
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/**
 * The server's `TransactionStatus` (Domain/Billing/TransactionStatus.cs) is an
 * enum and the API writes enums as numbers - there is no string-enum
 * converter registered, so a transaction arrives as `"status": 1`. It is
 * given its name once, here, and every screen works with the name.
 *
 * Until wave 3's review the screens compared `status` to `'Completed'`
 * straight off the wire, which no row ever equalled: the till showed "1" in
 * its status column, never offered "dokončit" or a refund, and the booking
 * offered "Zaplaceno" again after the payment was recorded.
 */
export type TransactionStatus = 'Pending' | 'Completed' | 'Cancelled' | 'Refunded';

const TRANSACTION_STATUS_NAMES: readonly TransactionStatus[] = ['Pending', 'Completed', 'Cancelled', 'Refunded'];

/**
 * The name for whatever the wire carries: the number the API writes today, or
 * the name itself should a string converter ever be registered. Anything else
 * is `null`, so a screen never mistakes an unknown value for an open payment.
 */
export function transactionStatusName(value: unknown): TransactionStatus | null {
  if (typeof value === 'number') return TRANSACTION_STATUS_NAMES[value] ?? null;
  if (typeof value === 'string') {
    const named = TRANSACTION_STATUS_NAMES.find((name) => name.toLowerCase() === value.toLowerCase());
    if (named) return named;
    const asNumber = Number(value);
    return value.trim() !== '' && Number.isInteger(asNumber) ? TRANSACTION_STATUS_NAMES[asNumber] ?? null : null;
  }
  return null;
}

/** The transaction as the API writes it: the status still a number. */
type WireTransaction = Omit<CashierTransaction, 'status'> & { status: number | string };

/**
 * The boundary: one mapping, applied to every transaction that comes in. A
 * value this client does not know keeps its raw text, so the till prints it
 * as it is and no button ("dokončit", "vrátit") matches it.
 */
export function fromWire(raw: WireTransaction): CashierTransaction {
  const status = transactionStatusName(raw.status) ?? String(raw.status);
  return { ...raw, status: status as TransactionStatus, paymentMethod: Number(raw.paymentMethod) as PaymentMethod };
}

export interface CashierTransaction {
  id: string;
  serviceId: string;
  patientId: string;
  clubId?: string | null;
  /** The booking this payment settles; null for a walk-in payment. */
  appointmentId?: string | null;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  vatRate: number;
  paymentMethod: PaymentMethod;
  /** The name, mapped from the wire's number by `fromWire`; never the raw value. */
  status: TransactionStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface DashboardStats {
  todayRevenue: number;
  transactionsCount: number;
  cashTransactions: number;
  cardTransactions: number;
  clubBillingTransactions: number;
  averageTransaction: number;
  totalDiscounts: number;
}

export interface CreateTransactionInput {
  serviceId: string;
  patientId: string;
  originalPrice: number;
  paymentMethod: PaymentMethod;
  discountAmount?: number;
  discountReason?: string;
  notes?: string;
  /** From the appointment detail; left out for a walk-in. */
  appointmentId?: string;
}

const unwrap = (res: any) => res.data?.value ?? res.data?.data ?? res.data;

export const cashierApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await client.get('/api/cashier/dashboard');
    return unwrap(res);
  },

  getTransactions: async (date: string): Promise<CashierTransaction[]> => {
    const res = await client.get(`/api/cashier/transactions?date=${encodeURIComponent(date)}`);
    const d = unwrap(res);
    return Array.isArray(d) ? d.map(fromWire) : [];
  },

  /** Every payment recorded against one booking, newest first. */
  getByAppointment: async (appointmentId: string): Promise<CashierTransaction[]> => {
    const res = await client.get(`/api/cashier/appointments/${appointmentId}/transactions`);
    const d = unwrap(res);
    return Array.isArray(d) ? d.map(fromWire) : [];
  },

  /**
   * Records a payment. The VAT rate is the clinic's setting and the server
   * applies it whatever is sent, so none is sent; who took the money is the
   * signed-in account, decided by the server. Cash and card come back
   * `Completed`; a transfer or a club charge stays `Pending` until `complete`.
   */
  createTransaction: async (data: CreateTransactionInput): Promise<CashierTransaction> => {
    const res = await client.post('/api/cashier/transactions', {
      discountAmount: 0,
      ...data,
    });
    return fromWire(unwrap(res));
  },

  /** An open payment (transfer, club) has arrived. */
  complete: async (id: string): Promise<CashierTransaction> => {
    const res = await client.post(`/api/cashier/transactions/${id}/complete`);
    return fromWire(unwrap(res));
  },

  cancelTransaction: async (id: string, reason?: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/cancel`, { reason: reason ?? null });
  },

  /** A completed payment given back. The reason is required by the server. */
  refundTransaction: async (id: string, reason: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/refund`, { reason });
  },
};
