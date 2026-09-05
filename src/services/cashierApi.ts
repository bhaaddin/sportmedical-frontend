import client from '../api/client';

export enum PaymentMethod {
  Cash = 0,
  Card = 1,
  ClubBilling = 2,
  BankTransfer = 3,
}

export interface CashierTransaction {
  id: string;
  serviceId: string;
  patientId: string;
  clubId?: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  vatRate: number;
  paymentMethod: PaymentMethod;
  status: string;
  createdAt: string;
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

  createTransaction: async (data: {
    serviceId: string;
    patientId: string;
    originalPrice: number;
    vatRate?: number;
    paymentMethod: PaymentMethod;
    discountAmount?: number;
    discountReason?: string;
    notes?: string;
  }): Promise<CashierTransaction> => {
    const res = await client.post('/api/cashier/transactions', {
      vatRate: 0,
      discountAmount: 0,
      ...data,
    });
    return unwrap(res);
  },

  cancelTransaction: async (id: string, reason?: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/cancel`, { reason: reason ?? null });
  },

  refundTransaction: async (id: string, reason: string): Promise<void> => {
    await client.post(`/api/cashier/transactions/${id}/refund`, { reason });
  },
};
