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
  /*
   * Not in InvoiceDto today. A club invoice ("FK Slaný · 12× Komplexní
   * prohlídka") is what the board's "Kluby" filter and the "Vystaveno" state
   * are about; the screen reads these when the server starts sending them and
   * treats every invoice as a patient's until then.
   */
  clubId?: string | null;
  clubName?: string | null;
}

/** The names `POST /api/billing/invoices/{id}/payment` parses into its PaymentMethod enum. */
export type InvoicePaymentMethod = 'Cash' | 'Card' | 'Transfer' | 'ClubBilling';

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

  /* Records money received against an invoice; the server moves it to
     PartiallyPaid or Paid by itself and refuses a cancelled or refunded one. */
  recordPayment: async (
    invoiceId: string,
    data: { amount: number; method: InvoicePaymentMethod },
  ): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/payment`, data);
    return res.data?.value ?? res.data;
  },
};
