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

/** The status names the server writes. Translated at the point of display. */
export type TransactionStatus = 'Pending' | 'Completed' | 'Cancelled' | 'Refunded';

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
  status: TransactionStatus | string;
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
    return Array.isArray(d) ? d : [];
  },

  /** Every payment recorded against one booking, newest first. */
  getByAppointment: async (appointmentId: string): Promise<CashierTransaction[]> => {
    const res = await client.get(`/api/cashier/appointments/${appointmentId}/transactions`);
    const d = unwrap(res);
    return Array.isArray(d) ? d : [];
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
    return unwrap(res);
  },

  /** An open payment (transfer, club) has arrived. */
  complete: async (id: string): Promise<CashierTransaction> => {
    const res = await client.post(`/api/cashier/transactions/${id}/complete`);
    return unwrap(res);
  },

  cancelTransaction: async (id: string, reason?: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/cancel`, { reason: reason ?? null });
  },

  /** A completed payment given back. The reason is required by the server. */
  refundTransaction: async (id: string, reason: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/refund`, { reason });
  },
};
