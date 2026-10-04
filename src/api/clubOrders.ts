/* ══════════════════════════════════════════════════════════════
   KLUBOVÉ OBJEDNÁVKY (club orders) — the shared API module (Etapa 4, contract C-O in docs/etapa4/BRIEF.md)

   Types and calls for the staff endpoints under /api/v1/club-orders and the club summary / stats. Readers are
   TOLERANT: an absent field reads as empty, an unknown status as 'Requested', so a screen never white-screens
   because the server has not shipped a field yet. Nothing here knows a price, a day count or a clinic name.
   ══════════════════════════════════════════════════════════════ */

import client from './client';
import type { ClubBlockView } from './clubBlocks';

export type ClubOrderStatus = 'Invited' | 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'ClubInvoice' | 'PerPerson';

export const ORDER_STATUSES: readonly ClubOrderStatus[] = ['Invited', 'Requested', 'Confirmed', 'Completed', 'Cancelled'];

/** One term the club asked for or the desk confirmed. Dates yyyy-MM-dd, times HH:mm. */
export interface OrderRange {
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
}

export interface OrderActivitySeats {
  activityId: string;
  activityName: string;
  durationMinutes: number;
  seats: number;
  registered: number;
  unitPriceCzk: number | null;
}

export interface OrderDiscount {
  kind: string;
  label: string;
  percent: number;
  amountCzk: number;
}

export interface OrderPriceQuote {
  listTotalCzk: number;
  discounts: OrderDiscount[];
  totalCzk: number;
}

export interface OrderContact {
  name: string;
  phone: string;
  email: string;
}

export interface OrderHistoryItem {
  atUtc: string;
  user: string;
  text: string;
}

export interface ClubOrderView {
  id: string;
  clubId: string;
  clubName: string;
  clubColorHex: string | null;
  serviceId: string | null;
  serviceName: string;
  status: ClubOrderStatus;
  paymentMethod: PaymentMethod | null;
  activitySeats: OrderActivitySeats[];
  totalSeats: number;
  registered: number;
  priceQuote: OrderPriceQuote | null;
  requestedRanges: OrderRange[];
  /** Etapa 8: the days the desk offered the club to choose from (sorted, yyyy-MM-dd); empty = the club chooses freely. */
  offeredDates?: string[];
  /** Etapa 8: the single days the club chose (sorted); empty until it submitted. */
  requestedDates?: string[];
  blocks: ClubBlockView[];
  note: string;
  contact: OrderContact | null;
  formToken: string;
  formUrl: string;
  registrationToken: string;
  registrationUrl: string;
  releaseDaysBefore: number | null;
  effectiveReleaseDaysBefore: number | null;
  createdBy: 'Staff' | 'Club';
  createdAtUtc: string;
  submittedAtUtc: string | null;
  confirmedAtUtc: string | null;
  history: OrderHistoryItem[];
  /** Etapa 5: an addendum points at the ROOT of its group; null on a root and on a lone order. */
  parentOrderId: string | null;
  /** The root's id (equals `id` on a root). */
  groupId: string;
  /** Filled on the root only: every addendum, cancelled ones too. */
  addenda: OrderAddendumSummary[];
  /** Identical on every order of the group: live orders only. */
  groupTotals: OrderGroupTotals;
  /** The invoice that billed THIS order (every billed order of a group carries its own); null until invoiced. */
  invoiceId: string | null;
}

export interface OrderAddendumSummary {
  id: string;
  serviceName: string;
  status: ClubOrderStatus;
  totalSeats: number;
  registered: number;
  totalCzk: number | null;
}

export interface OrderGroupTotals {
  totalSeats: number;
  registered: number;
  listTotalCzk: number;
  discountCzk: number;
  totalCzk: number;
}

export interface InvoiceDraftLine {
  orderId: string;
  serviceName: string;
  activityName: string;
  quantity: number;
  unitPriceCzk: number;
  totalCzk: number;
}

export interface InvoiceDraft {
  clubId: string;
  groupId: string;
  paymentMethod: PaymentMethod | null;
  headcount: number;
  lines: InvoiceDraftLine[];
  discounts: OrderDiscount[];
  listTotalCzk: number;
  totalCzk: number;
  note: string;
  /** Only when nothing is left to bill: the group's latest invoice. Null while there are lines to invoice. */
  invoiceId: string | null;
  /** Other orders of the group are already invoiced: this is a "dodatečná faktura". */
  supplementary: boolean;
  /** The billable orders an invoice already covers, with that invoice. */
  alreadyInvoiced: AlreadyInvoiced[];
}

export interface AlreadyInvoiced {
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
}

export interface CreatedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalCzk: number;
  clubId: string;
  groupId: string;
  /** false when the group already had its invoice (HTTP 200). */
  created: boolean;
  /** The group has other invoices: this one billed orders added after an earlier one. */
  supplementary: boolean;
}

/** What the desk sends to create an order directly (phone order, "chytrá zkratka"). */
export interface StaffOrderInput {
  clubId: string;
  serviceId: string;
  activitySeats: { activityId: string; seats: number }[];
  paymentMethod: PaymentMethod | null;
  ranges: OrderRange[];
  calendarIds: string[];
  status: 'Confirmed' | 'Requested';
  note?: string;
  releaseDaysBefore?: number | null;
  /** Etapa 5: add this order to the group of that order (one invoice). */
  parentOrderId?: string;
}

export interface OrderUpdateInput {
  activitySeats?: { activityId: string; seats: number }[];
  paymentMethod?: PaymentMethod | null;
  ranges?: OrderRange[];
  calendarIds?: string[];
  note?: string;
  releaseDaysBefore?: number | null;
}

export interface ClubSummary {
  clubId: string;
  clubName?: string;
  totalSeats: number;
  registered: number;
  remaining: number;
  byService: { serviceId: string; serviceName: string; seats: number; registered: number }[];
  byActivity: { activityId: string; activityName: string; serviceName: string; seats: number; registered: number; remaining: number }[];
  ordersByStatus: Record<ClubOrderStatus, number>;
  bookedMinutes: number;
  usedMinutes: number;
}

export interface ClubOrderStats {
  totals: ClubSummary;
  byClub: ClubSummary[];
  byService: ClubSummary['byService'];
  byActivity: ClubSummary['byActivity'];
}

/** A refusal that names the athletes it would hit (409), like the block endpoints. */
export class ClubOrderError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly affectedAthletes: { id?: string; name: string; activityName?: string; startUtc?: string }[];
  readonly fieldErrors: Record<string, string[]>;
  /** 409 `club_order.addenda_live`: the addenda that still hold places. */
  addenda: OrderAddendumSummary[] = [];
  constructor(message: string, status?: number, code?: string, affected: ClubOrderError['affectedAthletes'] = [], fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ClubOrderError';
    this.status = status;
    this.code = code;
    this.affectedAthletes = affected;
    this.fieldErrors = fields;
  }
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const statusOf = (v: unknown): ClubOrderStatus => (ORDER_STATUSES.includes(v as ClubOrderStatus) ? (v as ClubOrderStatus) : 'Requested');

export function toRange(raw: unknown): OrderRange {
  const r = rec(raw);
  return {
    fromDate: str(r.fromDate),
    toDate: str(r.toDate, str(r.fromDate)),
    dailyFrom: typeof r.dailyFrom === 'string' && r.dailyFrom !== '' ? r.dailyFrom : null,
    dailyTo: typeof r.dailyTo === 'string' && r.dailyTo !== '' ? r.dailyTo : null,
  };
}

export function toAddendum(raw: unknown): OrderAddendumSummary {
  const x = rec(raw);
  return {
    id: str(x.id),
    serviceName: str(x.serviceName),
    status: statusOf(x.status),
    totalSeats: num(x.totalSeats),
    registered: num(x.registered),
    totalCzk: typeof x.totalCzk === 'number' ? x.totalCzk : null,
  };
}

export function toInvoiceDraft(raw: unknown): InvoiceDraft {
  const d = rec(raw);
  return {
    clubId: str(d.clubId),
    groupId: str(d.groupId),
    paymentMethod: d.paymentMethod === 'ClubInvoice' || d.paymentMethod === 'PerPerson' ? d.paymentMethod : null,
    headcount: num(d.headcount),
    lines: arr<unknown>(d.lines).map((l) => {
      const x = rec(l);
      return { orderId: str(x.orderId), serviceName: str(x.serviceName), activityName: str(x.activityName), quantity: num(x.quantity), unitPriceCzk: num(x.unitPriceCzk), totalCzk: num(x.totalCzk) };
    }),
    discounts: arr<unknown>(d.discounts).map((d0) => {
      const x = rec(d0);
      return { kind: str(x.kind), label: str(x.label), percent: num(x.percent), amountCzk: num(x.amountCzk) };
    }),
    listTotalCzk: num(d.listTotalCzk),
    totalCzk: num(d.totalCzk),
    note: str(d.note),
    invoiceId: typeof d.invoiceId === 'string' && d.invoiceId !== '' ? d.invoiceId : null,
    supplementary: d.supplementary === true,
    alreadyInvoiced: arr<unknown>(d.alreadyInvoiced).map((a) => {
      const x = rec(a);
      return { orderId: str(x.orderId), invoiceId: str(x.invoiceId), invoiceNumber: str(x.invoiceNumber) };
    }),
  };
}

export function toCreatedInvoice(raw: unknown, status?: number): CreatedInvoice {
  const d = rec(raw);
  return {
    invoiceId: str(d.invoiceId),
    invoiceNumber: str(d.invoiceNumber),
    status: str(d.status),
    totalCzk: num(d.totalCzk),
    clubId: str(d.clubId),
    groupId: str(d.groupId),
    created: typeof d.created === 'boolean' ? d.created : status === 201,
    supplementary: d.supplementary === true,
  };
}

/** Tolerant: only well-formed yyyy-MM-dd strings, sorted and unique. */
function dates(v: unknown): string[] {
  return [...new Set(arr<unknown>(v).filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10)))].sort();
}

export function toOrder(raw: unknown): ClubOrderView {
  const o = rec(raw);
  const totals = rec(o.groupTotals);
  const quote = o.priceQuote === null || o.priceQuote === undefined ? null : rec(o.priceQuote);
  const contact = o.contact === null || o.contact === undefined ? null : rec(o.contact);
  return {
    id: str(o.id),
    clubId: str(o.clubId),
    clubName: str(o.clubName),
    clubColorHex: typeof o.clubColorHex === 'string' ? o.clubColorHex : null,
    serviceId: typeof o.serviceId === 'string' ? o.serviceId : null,
    serviceName: str(o.serviceName),
    status: statusOf(o.status),
    paymentMethod: o.paymentMethod === 'ClubInvoice' || o.paymentMethod === 'PerPerson' ? o.paymentMethod : null,
    activitySeats: arr<unknown>(o.activitySeats).map((s) => {
      const x = rec(s);
      return {
        activityId: str(x.activityId),
        activityName: str(x.activityName),
        durationMinutes: num(x.durationMinutes),
        seats: num(x.seats),
        registered: num(x.registered),
        unitPriceCzk: typeof x.unitPriceCzk === 'number' ? x.unitPriceCzk : null,
      };
    }),
    totalSeats: num(o.totalSeats),
    registered: num(o.registered),
    priceQuote: quote === null
      ? null
      : {
          listTotalCzk: num(quote.listTotalCzk),
          discounts: arr<unknown>(quote.discounts).map((d) => {
            const x = rec(d);
            return { kind: str(x.kind), label: str(x.label), percent: num(x.percent), amountCzk: num(x.amountCzk) };
          }),
          totalCzk: num(quote.totalCzk),
        },
    requestedRanges: arr<unknown>(o.requestedRanges).map(toRange),
    offeredDates: dates(o.offeredDates),
    requestedDates: dates(o.requestedDates),
    blocks: arr<ClubBlockView>(o.blocks),
    note: str(o.note),
    contact: contact === null ? null : { name: str(contact.name), phone: str(contact.phone), email: str(contact.email) },
    formToken: str(o.formToken),
    formUrl: str(o.formUrl),
    registrationToken: str(o.registrationToken),
    registrationUrl: str(o.registrationUrl),
    releaseDaysBefore: typeof o.releaseDaysBefore === 'number' ? o.releaseDaysBefore : null,
    effectiveReleaseDaysBefore: typeof o.effectiveReleaseDaysBefore === 'number' ? o.effectiveReleaseDaysBefore : null,
    createdBy: o.createdBy === 'Club' ? 'Club' : 'Staff',
    createdAtUtc: str(o.createdAtUtc),
    submittedAtUtc: typeof o.submittedAtUtc === 'string' ? o.submittedAtUtc : null,
    confirmedAtUtc: typeof o.confirmedAtUtc === 'string' ? o.confirmedAtUtc : null,
    history: arr<unknown>(o.history).map((h) => {
      const x = rec(h);
      return { atUtc: str(x.atUtc), user: str(x.user), text: str(x.text) };
    }),
    parentOrderId: typeof o.parentOrderId === 'string' && o.parentOrderId !== '' ? o.parentOrderId : null,
    groupId: str(o.groupId, str(o.parentOrderId, str(o.id))),
    addenda: arr<unknown>(o.addenda).map(toAddendum),
    groupTotals: {
      totalSeats: num(totals.totalSeats, num(o.totalSeats)),
      registered: num(totals.registered, num(o.registered)),
      listTotalCzk: num(totals.listTotalCzk, quote === null ? 0 : num(quote.listTotalCzk)),
      discountCzk: num(totals.discountCzk),
      totalCzk: num(totals.totalCzk, quote === null ? 0 : num(quote.totalCzk)),
    },
    invoiceId: typeof o.invoiceId === 'string' && o.invoiceId !== '' ? o.invoiceId : null,
  };
}

/** The server wraps some answers in `{ success, data }`; accept both. */
const unwrap = (body: unknown): unknown => {
  const b = rec(body);
  return 'data' in b && !('id' in b) ? b.data : body;
};

function toError(error: unknown): ClubOrderError {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = rec(response?.data);
  const message = typeof data.message === 'string' && data.message.trim() !== '' ? data.message.trim() : 'Požadavek se nepodařilo dokončit.';
  const affected = arr<unknown>(data.affectedAthletes).map((a) => {
    const x = rec(a);
    return { id: typeof x.id === 'string' ? x.id : undefined, name: str(x.name), activityName: typeof x.activityName === 'string' ? x.activityName : undefined, startUtc: typeof x.startUtc === 'string' ? x.startUtc : undefined };
  });
  const errors = rec(data.errors);
  const fields: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(errors)) fields[k] = arr<string>(v).filter((s) => typeof s === 'string');
  const err = new ClubOrderError(message, response?.status, typeof data.code === 'string' ? data.code : undefined, affected, fields);
  err.addenda = arr<unknown>(data.addenda).map(toAddendum);
  return err;
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toError(error);
  }
}

const BASE = '/api/v1/club-orders';

export const clubOrdersApi = {
  /** Creates an order in status Invited and returns it with its form link (nothing is e-mailed). */
  invite: (input: { clubId: string; serviceId?: string; note?: string; offeredDates?: string[] }): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.post(BASE, input)).data))),

  /** Etapa 8: replaces the offered days while the order is Invited or Requested (empty list = free term). */
  setOfferedDates: (id: string, dates: string[]): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.put(`${BASE}/${id}/offered-dates`, { dates })).data))),

  /** A phone order or the calendar shortcut: Confirmed creates the blocks atomically. */
  createStaff: (input: StaffOrderInput): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.post(`${BASE}/staff`, input)).data))),

  list: (filter: { clubId?: string; status?: ClubOrderStatus; from?: string; to?: string; groupId?: string } = {}): Promise<ClubOrderView[]> =>
    call(async () => {
      const body = unwrap((await client.get(BASE, { params: filter })).data);
      return arr<unknown>(body).map(toOrder);
    }),

  get: (id: string): Promise<ClubOrderView> => call(async () => toOrder(unwrap((await client.get(`${BASE}/${id}`)).data))),

  update: (id: string, input: OrderUpdateInput, cancelAffectedAthletes = false): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.put(`${BASE}/${id}`, input, { params: cancelAffectedAthletes ? { cancelAffectedAthletes: true } : undefined })).data))),

  confirm: (id: string, input: { calendarIds: string[]; ranges: OrderRange[] }): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.post(`${BASE}/${id}/confirm`, input)).data))),

  cancel: (id: string, cancelAthletes = false, cancelAddenda = false): Promise<ClubOrderView> =>
    call(async () => toOrder(unwrap((await client.post(`${BASE}/${id}/cancel`, null, { params: cancelAddenda ? { cancelAthletes, cancelAddenda: true } : { cancelAthletes } })).data))),

  /** What the group's one invoice would hold (a read; works for PerPerson too, the invoice itself is refused). */
  invoiceDraft: (id: string): Promise<InvoiceDraft> =>
    call(async () => toInvoiceDraft((await client.get(`${BASE}/${id}/invoice-draft`)).data)),

  /** Creates the group's one invoice (201) or returns the existing one (200, `created: false`). */
  createInvoice: (id: string): Promise<CreatedInvoice> =>
    call(async () => {
      const response = await client.post(`${BASE}/${id}/invoice`, null);
      return toCreatedInvoice(response.data, response.status);
    }),

  clubSummary: (clubId: string): Promise<ClubSummary> =>
    call(async () => unwrap((await client.get(`/api/v1/clubs/${clubId}/summary`)).data) as ClubSummary),

  stats: (range: { from?: string; to?: string } = {}): Promise<ClubOrderStats> =>
    call(async () => unwrap((await client.get(`${BASE}/stats`, { params: range })).data) as ClubOrderStats),
};

export const ORDER_STATUS_LABEL: Record<ClubOrderStatus, string> = {
  Invited: 'Čeká na formulář',
  Requested: 'Odesláno klubem',
  Confirmed: 'Potvrzeno',
  Completed: 'Dokončeno',
  Cancelled: 'Zrušeno',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  ClubInvoice: 'Platí klub (jedna faktura)',
  PerPerson: 'Platí rodiče / hráči sami',
};
