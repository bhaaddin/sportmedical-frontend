/* ══════════════════════════════════════════════════════════════
   JEDNA OBJEDNÁVKA NA KLUB — the one API module of the feature (backend branch club/one-order).

   Every call fails SOFT: a server that has not shipped the routes answers 404 / 405 and the read gives `null`
   ("not available" - the screens then hide the feature, like SendMessageDialog does). The shapes are read leniently
   with zod (optional / nullable where reasonable, status and origin as a word or a number), and they all live here, so
   a change of the backend contract is a fix in one place.

     GET/PUT  club-orders/one-order-settings   { clubIds }
     GET      club-orders/{id}/combined        the club's one order with all its days
     POST     club-orders/{id}/close | reopen
     POST     club-orders/{id}/split           { orderIds }
   (the invoice calls with a subset are in clubOrders.ts: invoiceDraft / createInvoice)
   ══════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import client from './client';
import type { ClubOrderStatus } from './clubOrders';

const BASE = '/api/v1/club-orders';

/* ── schemas ─────────────────────────────────────────────── */

const text = z.string().catch('');
const textOrNull = z.string().nullish().transform((v) => (v === undefined || v === null || v === '' ? null : v));
const count = z.number().catch(0);

/** The order status as the server writes it: a word, or the enum's number (Invited, Requested, Confirmed, Completed, Cancelled). */
const STATUS_BY_NUMBER: readonly ClubOrderStatus[] = ['Invited', 'Requested', 'Confirmed', 'Completed', 'Cancelled'];
export function readStatus(v: unknown): ClubOrderStatus {
  if (typeof v === 'number') return STATUS_BY_NUMBER[v] ?? 'Requested';
  return STATUS_BY_NUMBER.includes(v as ClubOrderStatus) ? (v as ClubOrderStatus) : 'Requested';
}
const status = z.unknown().transform(readStatus);
/** Origin is kept as it came (word or number as text); nothing decides on it. */
const origin = z.union([z.string(), z.number()]).nullish().transform((v) => (v === undefined || v === null ? '' : String(v)));

const link = z.object({ orderId: text, reference: text });

const range = z.object({
  fromDate: text,
  toDate: text,
  dailyFrom: textOrNull,
  dailyTo: textOrNull,
});

const day = z.object({
  orderId: text,
  reference: text,
  serviceId: textOrNull,
  serviceName: text,
  ranges: z.array(range).catch([]),
  seats: count,
  registered: count,
  status,
  origin,
  createdAtUtc: text,
  createdByName: textOrNull,
  note: text.nullish().transform((v) => v ?? ''),
  invoiceId: textOrNull,
  invoiceNumber: textOrNull,
});

export const combinedSchema = z.object({
  rootId: text,
  reference: text,
  clubId: text,
  clubName: text,
  closedAtUtc: textOrNull,
  oneOrderMode: z.boolean().catch(false),
  splitFrom: link.nullish().transform((v) => (v === undefined || v === null || v.orderId === '' ? null : v)),
  splitInto: z.array(link).nullish().transform((v) => v ?? []),
  days: z.array(day).catch([]),
  totals: z.object({ orders: count, seats: count, registered: count, invoicedOrders: count }).catch({ orders: 0, seats: 0, registered: 0, invoicedOrders: 0 }),
  clubTotal: z.object({ parts: count, seats: count, registered: count }).catch({ parts: 1, seats: 0, registered: 0 }),
});

export const settingsSchema = z.object({ clubIds: z.array(z.string()).catch([]) });

export type CombinedOrder = z.infer<typeof combinedSchema>;
export type CombinedDay = CombinedOrder['days'][number];
export type OneOrderSettings = z.infer<typeof settingsSchema>;

/* ── calls ───────────────────────────────────────────────── */

/** 404 / 405: the server does not have the route (yet). Works for axios errors and for the mapped API errors. */
export function isMissing(error: unknown): boolean {
  const e = error as { response?: { status?: number }; status?: number; kind?: string } | null;
  const code = e?.response?.status ?? e?.status;
  return code === 404 || code === 405 || e?.kind === 'notFound';
}

async function soft<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

const body = (raw: unknown): unknown => {
  const r = raw as { data?: unknown; success?: unknown } | null;
  return r !== null && typeof r === 'object' && 'data' in r && r.data !== null && typeof r.data === 'object' && !('clubIds' in r) && !('rootId' in r) ? r.data : raw;
};

/** `null` = the server has no such setting (feature hidden). */
export const getOneOrderSettings = (): Promise<OneOrderSettings | null> =>
  soft(async () => settingsSchema.parse(body((await client.get(`${BASE}/one-order-settings`)).data)));

export const putOneOrderSettings = async (clubIds: string[]): Promise<OneOrderSettings> =>
  settingsSchema.parse(body((await client.put(`${BASE}/one-order-settings`, { clubIds })).data));

/** The clubs in one-order mode; [] when the server cannot say (never throws - it only spares a question). */
export async function oneOrderClubIds(): Promise<string[]> {
  try {
    return (await getOneOrderSettings())?.clubIds ?? [];
  } catch {
    return [];
  }
}

/** `null` = no combined view (404): the order is shown as before. */
export const getCombined = (orderId: string): Promise<CombinedOrder | null> =>
  soft(async () => combinedSchema.parse(body((await client.get(`${BASE}/${orderId}/combined`)).data)));

export const closeOrder = async (orderId: string): Promise<void> => { await client.post(`${BASE}/${orderId}/close`, null); };
export const reopenOrder = async (orderId: string): Promise<void> => { await client.post(`${BASE}/${orderId}/reopen`, null); };

/** Returns the new root's id when the server names one (any JSON is accepted), else null. */
export async function splitOrder(orderId: string, orderIds: string[]): Promise<string | null> {
  const data = body((await client.post(`${BASE}/${orderId}/split`, { orderIds })).data) as { id?: unknown; rootId?: unknown } | null;
  const id = data?.rootId ?? data?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}
