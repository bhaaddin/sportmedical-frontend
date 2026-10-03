/* ══════════════════════════════════════════════════════════════
   BILLING API
   Invoices - to a person, a group or a team (club) - their line items,
   the server-side price quote, approval and the PDF.

   Contract C3 (docs/etapa2/BRIEF.md): the server prices the lines, the
   screen only shows what it is told.
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

/** Who an invoice is made out to: a patient, a free group or firm, or a club. */
export type RecipientType = 'Person' | 'Group' | 'Team';

/** Which of the four discounts a row of the breakdown is. */
export type DiscountKind = 'tier' | 'club' | 'package' | 'manual';

/** One row of the breakdown, on a quote and on an issued invoice alike. */
export interface InvoiceDiscount {
  kind: DiscountKind;
  label: string;
  percent: number;
  amountCzk: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  invoiceNumber: string;
  /** Draft / Issued / PartiallyPaid / Paid / Refunded / Cancelled / PendingApproval / Rejected. */
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
  /* ── C3 ── absent on an older server, which means a patient's invoice. */
  recipientType?: RecipientType;
  /** The name to print: the patient, the group or the club. */
  recipientName?: string | null;
  headcount?: number | null;
  discounts?: InvoiceDiscount[];
  approvedBy?: string | null;
  approvedAtUtc?: string | null;
  rejectedReason?: string | null;
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

/** A free group or firm - not a patient and not a club. */
export interface InvoiceGroup {
  name: string;
  ico?: string;
  dic?: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface QuoteLineRequest {
  activityId: string;
  quantity: number;
}

export interface PriceQuoteRequest {
  recipientType: RecipientType;
  clubId?: string;
  headcount?: number;
  lines: QuoteLineRequest[];
  manualDiscountPercent?: number;
}

export interface PriceQuoteLine {
  activityId: string;
  name: string;
  quantity: number;
  unitPriceCzk: number;
  listTotalCzk: number;
}

export interface PriceQuote {
  lines: PriceQuoteLine[];
  listTotalCzk: number;
  discounts: InvoiceDiscount[];
  /** max(tier, club) for a group or a team; 0 for a person. */
  appliedGroupPercent: number;
  totalCzk: number;
  /** The most manual discount the caller may give without approval. */
  manualAllowedPercent: number;
  requiresApproval: boolean;
}

export interface CreateInvoiceRequest {
  recipientType: RecipientType;
  /** Required for `Person` only. */
  patientId?: string;
  clubId?: string;
  group?: InvoiceGroup;
  headcount?: number;
  manualDiscountPercent?: number;
  manualDiscountReason?: string;
  /** The server prices these through the quote. */
  lines: QuoteLineRequest[];
  notes?: string;
  appointmentId?: string;
}

/** What `GET /api/v1/club-blocks/{id}` says that the invoice needs (contract C4). */
export interface ClubBlockSummary {
  id: string;
  clubId: string;
  clubName?: string;
  activityIds: string[];
  playerCount: number;
}

const unwrap = <T>(data: unknown): T => {
  const body = data as { value?: T } | T;
  return ((body as { value?: T })?.value ?? body) as T;
};

export const billingApi = {
  getInvoices: async (filter: { patientId?: string; clubId?: string } = {}): Promise<Invoice[]> => {
    const res = await client.get('/api/billing/invoices', {
      params: { patientId: filter.patientId || undefined, clubId: filter.clubId || undefined },
    });
    return res.data?.value ?? res.data ?? [];
  },

  createInvoice: async (data: CreateInvoiceRequest): Promise<Invoice> => {
    const res = await client.post('/api/billing/invoices', data);
    return unwrap<Invoice>(res.data);
  },

  addLineItem: async (invoiceId: string, serviceId: string): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/items`, { serviceId });
    return unwrap<Invoice>(res.data);
  },

  /* What the lines cost with every discount applied - the only place the
     arithmetic lives. `signal` lets a newer question cancel an older one. */
  priceQuote: async (body: PriceQuoteRequest, signal?: AbortSignal): Promise<PriceQuote> => {
    const res = await client.post('/api/v1/billing/price-quote', body, { signal });
    return unwrap<PriceQuote>(res.data);
  },

  /* Records money received against an invoice; the server moves it to
     PartiallyPaid or Paid by itself and refuses a cancelled or refunded one. */
  recordPayment: async (
    invoiceId: string,
    data: { amountCzk: number; method: InvoicePaymentMethod; note?: string },
  ): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/payment`, data);
    return unwrap<Invoice>(res.data);
  },

  /* `billing.approve` - the invoice above somebody's discount limit. */
  approve: async (invoiceId: string): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/approve`, {});
    return unwrap<Invoice>(res.data);
  },

  reject: async (invoiceId: string, reason: string): Promise<Invoice> => {
    const res = await client.post(`/api/billing/invoices/${invoiceId}/reject`, { reason });
    return unwrap<Invoice>(res.data);
  },

  /* The PDF needs the bearer token, so it cannot be a plain link: it is
     fetched as a blob and the caller opens it. */
  getInvoicePdf: async (invoiceId: string): Promise<Blob> => {
    const res = await client.get(`/api/billing/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    return res.data as Blob;
  },

  /* A club block, for the invoice made from the club's page. */
  getClubBlock: async (blockId: string): Promise<ClubBlockSummary> => {
    const res = await client.get(`/api/v1/club-blocks/${blockId}`);
    return unwrap<ClubBlockSummary>(res.data);
  },
};
