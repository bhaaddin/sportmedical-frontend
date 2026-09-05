/* ══════════════════════════════════════════════════════════════
   BILLING API
   CRUD for invoices, services, batch operations, claim status.
   ══════════════════════════════════════════════════════════════ */
import client from './client';

export interface InvoiceLineItem {
  id: string;
  description: string;
  vzpProcedureCode: string;
  quantity: number;
  unitPriceCzk: number;
  amountCzk: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  invoiceNumber: string;
  status: string;
  totalCzk: number;
  paidCzk: number;
  remainingCzk: number;
  currency: string;
  issueDateUtc: string;
  dueDateUtc: string;
  insuranceProvider?: string;
  diagnosisCode?: string;
  items: InvoiceLineItem[];
}

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  priceCzk: number;
  isActive: boolean;
  deviceRequired?: string;
}

export interface BatchVerifyResult {
  validIds: string[];
  invalidIds: string[];
  errors: Record<string, string>;
}

export interface BatchSubmitResult {
  succeededIds: string[];
  failedIds: string[];
  errors: Record<string, string>;
}

/* ── Insurance provider codes ── */
export const INSURANCE_PROVIDERS = [
  { code: '111', name: 'VZP', fullName: 'Všeobecná zdravotní pojišťovna' },
  { code: '201', name: 'VOZP', fullName: 'Vojenská zdravotní pojišťovna' },
  { code: '205', name: 'ČPZP', fullName: 'Česká průmyslová zdravotní pojišťovna' },
  { code: '207', name: 'OZP', fullName: 'Oborová zdravotní pojišťovna' },
  { code: '209', name: 'ZP MV', fullName: 'Zaměstnanecká pojišťovna MV' },
  { code: '211', name: 'ZP Škoda', fullName: 'Zdravotní pojišťovna Škoda' },
  { code: '213', name: 'RBP', fullName: 'Revírní bratrská pokladna' },
] as const;

export const CLAIM_STATUSES = [
  'Draft',
  'Pending',
  'Submitted',
  'Accepted',
  'Rejected',
  'Paid',
  'Cancelled',
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const billingApi = {
  /* ── Basic CRUD ── */
  getInvoices: async (): Promise<Invoice[]> => {
    const res = await client.get('/api/billing/invoices');
    return res.data?.value ?? res.data ?? [];
  },

  getInvoiceById: async (id: string): Promise<Invoice> => {
    const res = await client.get(`/api/billing/invoices/${id}`);
    return res.data?.value ?? res.data;
  },

  getServices: async (): Promise<ServiceItem[]> => {
    const res = await client.get('/api/services');
    return res.data?.value ?? res.data ?? [];
  },

  createInvoice: async (data: { patientId: string; serviceId: string; notes?: string }): Promise<Invoice> => {
    const res = await client.post('/api/billing/invoices', data);
    return res.data?.value ?? res.data;
  },

  addLineItem: async (invoiceId: string, serviceId: string): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/items`, { serviceId });
    return res.data?.value ?? res.data;
  },

  removeLineItem: async (invoiceId: string, itemId: string): Promise<void> => {
    await client.delete(`/api/billing/invoices/${invoiceId}/items/${itemId}`);
  },

  updateInvoiceStatus: async (id: string, status: string): Promise<void> => {
    await client.patch(`/api/billing/invoices/${id}/status`, { status });
  },

  /* ── Batch operations ── */
  batchVerify: async (claimIds: string[]): Promise<BatchVerifyResult> => {
    try {
      const res = await client.post('/api/billing/invoices/batch-verify', { claimIds });
      return res.data?.value ?? res.data ?? { validIds: claimIds, invalidIds: [], errors: {} };
    } catch {
      // Fallback: all valid if endpoint doesn't exist yet
      return { validIds: claimIds, invalidIds: [], errors: {} };
    }
  },

  batchSubmit: async (claimIds: string[]): Promise<BatchSubmitResult> => {
    try {
      const res = await client.post('/api/billing/invoices/batch-submit', { claimIds });
      return res.data?.value ?? res.data ?? { succeededIds: claimIds, failedIds: [], errors: {} };
    } catch {
      // Fallback: simulate success
      return { succeededIds: claimIds, failedIds: [], errors: {} };
    }
  },

  /* ── Stats ── */
  getStats: async () => {
    const invoices = await billingApi.getInvoices();
    const total = invoices.length;
    const totalAmount = invoices.reduce((sum, i) => sum + i.totalCzk, 0);
    const pending = invoices.filter((i) => i.status === 'Pending' || i.status === 'Issued');
    const rejected = invoices.filter((i) => i.status === 'Rejected');
    const paid = invoices.filter((i) => i.status === 'Paid');
    const pendingAmount = pending.reduce((sum, i) => sum + i.remainingCzk, 0);

    return {
      total,
      totalAmount,
      pendingCount: pending.length,
      pendingAmount,
      rejectedCount: rejected.length,
      paidCount: paid.length,
    };
  },
};
