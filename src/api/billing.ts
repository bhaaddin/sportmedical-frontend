/* ══════════════════════════════════════════════════════════════
   BILLING API
   Invoices issued to patients and their line items.
   ══════════════════════════════════════════════════════════════ */
import client from './client';

export interface InvoiceLineItem {
  id: string;
  description: string;
  serviceCode: string;
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
  items: InvoiceLineItem[];
}

export const billingApi = {
  getInvoices: async (): Promise<Invoice[]> => {
    const res = await client.get('/api/billing/invoices');
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
};
