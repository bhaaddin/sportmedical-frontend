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
  /** The visit this invoice was issued for, when it came from one. */
  appointmentId?: string | null;
  /** The club that pays, when a club pays; `clubName` is its name. */
  clubId?: string | null;
  clubName?: string | null;
  /** How much of `paidCzk` came in each way. Absent on an older server. */
  cashPaidCzk?: number;
  cardPaidCzk?: number;
  transferPaidCzk?: number;
  clubPaidCzk?: number;
  /** Every payment received against the invoice, oldest first. */
  payments?: InvoicePayment[];
}

export interface InvoicePayment {
  id: string;
  amountCzk: number;
  method: InvoicePaymentMethod;
  paidAtUtc: string;
  note?: string | null;
}

/** The names `POST /api/billing/invoices/{id}/payment` parses into its PaymentMethod enum. */
export type InvoicePaymentMethod = 'Cash' | 'Card' | 'Transfer' | 'ClubBilling';

export const billingApi = {
  getInvoices: async (filter: { patientId?: string; clubId?: string } = {}): Promise<Invoice[]> => {
    const res = await client.get('/api/billing/invoices', {
      params: { patientId: filter.patientId || undefined, clubId: filter.clubId || undefined },
    });
    return res.data?.value ?? res.data ?? [];
  },

  createInvoice: async (data: {
    patientId: string;
    serviceId: string;
    notes?: string;
    appointmentId?: string;
    clubId?: string;
  }): Promise<Invoice> => {
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
    data: { amountCzk: number; method: InvoicePaymentMethod; note?: string },
  ): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/payment`, data);
    return res.data?.value ?? res.data;
  },
};
