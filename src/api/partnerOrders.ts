import client from './client';
import { toBookingError } from './apiError';
import {
  parseResponse,
  partnerNoticeListSchema,
  partnerOrderListSchema,
  partnerOrderSchema,
  type PartnerNotice,
  type PartnerOrder,
} from './bookingContracts';
import type { DateOnly } from '../utils/time';

/**
 * Partner reservations - contract 4.7, screens 5.10 and 5.11.
 *
 * Every write here answers with the **whole order**, recomputed, rather than
 * with the piece that changed. That is worth relying on: 4.7 says the counts
 * come from the appointments on each read, so the answer to a write is the
 * only number worth drawing. Nothing in this lane keeps a running total beside
 * them.
 *
 * Two body shapes were measured rather than read, because 4.7 documents the
 * responses and not the requests:
 *
 *   - `PUT .../items` takes a **bare array**, not `{ items: [...] }`. The
 *     wrapped form is refused with `400`. (The day-activity grid takes the
 *     opposite - `{ days: [...] }` - so neither is a house style.)
 *   - `partnerType` is a **number**: `0`, `1`, `2`. The strings that match the
 *     prose in 4.7 are refused.
 */

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export interface PartnerOrderInput {
  partnerName: string;
  partnerType: number;
  contactEmail?: string | null;
  note?: string | null;
}

export interface PartnerItemInput {
  activityId: string;
  requestedCount: number;
}

export interface PartnerWindowInput {
  date: DateOnly;
  startTime: string;
  endTime: string;
}

export const partnerOrdersApi = {
  list: (calendarId: string): Promise<PartnerOrder[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/partner-orders`);
      return parseResponse(partnerOrderListSchema, res.data);
    }),

  get: (calendarId: string, id: string): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.get(
        `/api/calendars/${calendarId}/partner-orders/${id}`,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  create: (calendarId: string, input: PartnerOrderInput): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/partner-orders`,
        input,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  /** The whole request, replaced. A bare array - see the note at the top. */
  setItems: (
    calendarId: string,
    id: string,
    items: PartnerItemInput[],
  ): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.put(
        `/api/calendars/${calendarId}/partner-orders/${id}/items`,
        items,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  addWindow: (
    calendarId: string,
    id: string,
    window: PartnerWindowInput,
  ): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/partner-orders/${id}/windows`,
        window,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  removeWindow: (
    calendarId: string,
    id: string,
    windowId: string,
  ): Promise<void> =>
    request(async () => {
      await client.delete(
        `/api/calendars/${calendarId}/partner-orders/${id}/windows/${windowId}`,
      );
    }),

  /** 4.7: extending a deadline is this, and `/extend` does not exist. */
  setDeadlines: (
    calendarId: string,
    id: string,
    deadlines: { releaseDate?: DateOnly; warnDate?: DateOnly; partnerReminderDate?: DateOnly },
  ): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.put(
        `/api/calendars/${calendarId}/partner-orders/${id}/deadlines`,
        deadlines,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  sendLink: (calendarId: string, id: string): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/partner-orders/${id}/link`,
        {},
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  /**
   * 4.7: releasing takes an audience. "Released" is not the same as "public" -
   * a window released to one club stays invisible to everybody else, so the
   * choice is never implied.
   */
  releaseWindow: (
    calendarId: string,
    id: string,
    windowId: string,
    audience: { toPublic: boolean; partnerOrderIds: string[] },
  ): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/partner-orders/${id}/windows/${windowId}/release`,
        audience,
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  /**
   * Closing the link - 4.7 as of v36, after this lane found that `isRevoked`
   * was a state on the view with no route that could reach it. `Revoke()` had
   * been on the entity since stage 7 and nobody had ever called it.
   *
   * It shuts the door rather than putting people out: the order, its items and
   * its windows all stay, anybody already booked keeps their appointment, and
   * the token stops opening. Revoking twice answers `200`, not an error.
   */
  revoke: (calendarId: string, id: string): Promise<PartnerOrder> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/partner-orders/${id}/revoke`,
        {},
      );
      return parseResponse(partnerOrderSchema, res.data);
    }),

  /** What falls due on a day. 4.7: it says what should be sent; sending is phase 2. */
  notices: (calendarId: string, date: DateOnly): Promise<PartnerNotice[]> =>
    request(async () => {
      const res = await client.get(
        `/api/calendars/${calendarId}/partner-orders/notices`,
        { params: { date } },
      );
      return parseResponse(partnerNoticeListSchema, res.data);
    }),
};

export default partnerOrdersApi;
