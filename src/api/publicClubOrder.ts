import axios from 'axios';
import { unwrapEnvelope, webHttp } from '../web/http';

/*
 * The public club order form (/klub-objednavka/:token) — contract C-O, public part.
 * Anonymous: the order's `formToken` is the only credential. Every number (prices,
 * the minimum of players, the needed minutes) is the server's; nothing here computes one.
 */

export type ClubPaymentMethod = 'ClubInvoice' | 'PerPerson';

export interface OrderActivity {
  activityId: string;
  name: string;
  durationMinutes: number;
  unitPriceCzk: number;
}

export interface OrderService {
  serviceId: string;
  serviceName: string;
  activities: OrderActivity[];
}

export interface ActivitySeat {
  activityId: string;
  seats: number;
}

/** A requested window: dates yyyy-MM-dd, times HH:mm. */
export interface OrderRange {
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
}

export interface OrderContact {
  name: string;
  phone: string;
  email: string;
}

export interface OrderDraft {
  serviceId: string | null;
  activitySeats: ActivitySeat[];
  ranges: OrderRange[];
  paymentMethod: ClubPaymentMethod | null;
  contact: OrderContact | null;
  note: string | null;
}

export interface OrderForm {
  clubName: string;
  status: string;
  services: OrderService[];
  paymentMethods: ClubPaymentMethod[];
  draft: OrderDraft | null;
  minimumPlayers: number | null;
  /** Relative `/klub/{token}` once the order is confirmed; players register through it. */
  registrationUrl: string | null;
  registrationOpen: boolean;
  /** Etapa 8: the days the clinic offers to choose from (yyyy-MM-dd, sorted). Empty = the club picks a free term. */
  offeredDates: string[];
}

export interface QuoteDiscount {
  kind: string;
  label: string;
  percent: number | null;
  amountCzk: number;
}

export interface OrderQuote {
  listTotalCzk: number;
  discounts: QuoteDiscount[];
  totalCzk: number;
  totalSeats: number;
  neededMinutes: number;
}

export interface SubmitInput {
  serviceId: string;
  activitySeats: ActivitySeat[];
  ranges: OrderRange[];
  paymentMethod: ClubPaymentMethod;
  contact: OrderContact;
  note?: string;
}

export interface SubmitResult {
  status: string;
  reference: string;
}

/** The link does not exist (404), was cancelled (410) or the order is already processed (409). */
export class ClubOrderLinkError extends Error {
  readonly kind: 'notFound' | 'gone' | 'processed';
  constructor(kind: 'notFound' | 'gone' | 'processed') {
    super(kind);
    this.kind = kind;
  }
}

/** A 400 with the server's field errors: `{ errors: { field: [messages] } }`. */
export class ClubOrderValidationError extends Error {
  readonly errors: Record<string, string[]>;
  constructor(errors: Record<string, string[]>) {
    super('validation');
    this.errors = errors;
  }
}

const base = (token: string): string => `/api/public/club-order/${encodeURIComponent(token)}`;

function linkError(error: unknown): never {
  if (axios.isAxiosError(error) && error.response) {
    const s = error.response.status;
    if (s === 404) throw new ClubOrderLinkError('notFound');
    if (s === 410) throw new ClubOrderLinkError('gone');
    if (s === 409) throw new ClubOrderLinkError('processed');
  }
  throw error;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function getOrderForm(token: string): Promise<OrderForm> {
  try {
    const { data } = await webHttp.get<unknown>(base(token));
    const raw = unwrapEnvelope(data) as OrderForm;
    return {
      clubName: str(raw.clubName),
      status: str(raw.status),
      services: Array.isArray(raw.services) ? raw.services.map((s) => ({
        serviceId: String(s.serviceId),
        serviceName: str(s.serviceName),
        activities: (Array.isArray(s.activities) ? s.activities : []).map((a) => ({
          activityId: String(a.activityId), name: str(a.name), durationMinutes: num(a.durationMinutes), unitPriceCzk: num(a.unitPriceCzk),
        })),
      })) : [],
      paymentMethods: Array.isArray(raw.paymentMethods) ? raw.paymentMethods : [],
      draft: raw.draft ?? null,
      minimumPlayers: typeof raw.minimumPlayers === 'number' ? raw.minimumPlayers : null,
      registrationUrl: typeof raw.registrationUrl === 'string' && raw.registrationUrl.trim() !== '' ? raw.registrationUrl : null,
      registrationOpen: raw.registrationOpen === true,
      offeredDates: [...new Set((Array.isArray(raw.offeredDates) ? raw.offeredDates : []).filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10)))].sort(),
    };
  } catch (error) {
    return linkError(error);
  }
}

/** Prices a selection. Pass the `AbortSignal` of the latest request so older ones can be cancelled. */
export async function quoteOrder(token: string, body: { serviceId: string; activitySeats: ActivitySeat[] }, signal?: AbortSignal): Promise<OrderQuote> {
  const { data } = await webHttp.post<unknown>(`${base(token)}/quote`, body, { signal });
  const raw = unwrapEnvelope(data) as OrderQuote;
  return {
    listTotalCzk: num(raw.listTotalCzk),
    discounts: Array.isArray(raw.discounts) ? raw.discounts : [],
    totalCzk: num(raw.totalCzk),
    totalSeats: num(raw.totalSeats),
    neededMinutes: num(raw.neededMinutes),
  };
}

export async function submitOrder(token: string, body: SubmitInput): Promise<SubmitResult> {
  try {
    const { data } = await webHttp.post<unknown>(`${base(token)}/submit`, body);
    const raw = unwrapEnvelope(data) as SubmitResult;
    return { status: str(raw.status), reference: str(raw.reference) };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      const errors = (error.response.data as { errors?: Record<string, string[]> } | undefined)?.errors;
      throw new ClubOrderValidationError(errors ?? {});
    }
    return linkError(error);
  }
}
