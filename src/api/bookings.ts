import client from './client';
import { toBookingError, BookingApiError } from './apiError';
import {
  availabilityListSchema,
  bookingDetailSchema,
  bookingListSchema,
  parseResponse,
  type AvailabilitySlot,
  type BookingDetail,
  type BookingListItem,
  type CreateBookingInput,
} from './bookingContracts';
import { addDaysToDateOnly, type DateOnly } from '../utils/time';

/**
 * Appointments and free times - contract 4.4 and 4.5, stage 3 onwards.
 *
 * Replaces the appointment half of `./calendar.ts`, which talks to
 * `/api/scheduling/appointments`. That endpoint goes away at the end of phase 1;
 * two endpoints over the same record are two models.
 *
 * Rule 6.1 governs this file: free times come from `getAvailability` and from
 * nowhere else. Nothing here derives a slot from working hours, from an
 * activity's length or from the bookings it just loaded.
 */

/** 4.5: the server refuses a wider window, so say so before the round trip. */
const MAX_RANGE_DAYS = 62;

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

function assertRangeWithinLimit(from: DateOnly, to: DateOnly): void {
  if (to < from) {
    throw new BookingApiError('validation', undefined);
  }
  if (addDaysToDateOnly(from, MAX_RANGE_DAYS) < to) {
    throw new BookingApiError('validation', undefined);
  }
}

export const bookingsApi = {
  /**
   * One request for the whole visible window and every visible calendar (7.3).
   * `calendarIds` goes over as a comma-separated list.
   */
  list: (
    calendarIds: string[],
    from: DateOnly,
    to: DateOnly,
    includeCancelled = false,
  ): Promise<BookingListItem[]> =>
    request(async () => {
      assertRangeWithinLimit(from, to);
      const res = await client.get('/api/bookings', {
        params: {
          calendarIds: calendarIds.join(','),
          from,
          to,
          includeCancelled,
        },
      });
      return parseResponse(bookingListSchema, res.data);
    }),

  get: (id: string): Promise<BookingDetail> =>
    request(async () => {
      const res = await client.get(`/api/bookings/${id}`);
      return parseResponse(bookingDetailSchema, res.data);
    }),

  /**
   * 6.3 forbids drawing the appointment before the server confirms it, so the
   * created booking is read back from this answer and never guessed.
   * A `409` here is a normal outcome, not an error: the slot went to someone
   * else between loading the offer and submitting.
   */
  create: (input: CreateBookingInput): Promise<BookingDetail> =>
    request(async () => {
      const res = await client.post('/api/bookings', input);
      return parseResponse(bookingDetailSchema, res.data);
    }),

  reschedule: (id: string, startUtc: string, overrideReason?: string): Promise<BookingDetail> =>
    request(async () => {
      const res = await client.post(`/api/bookings/${id}/reschedule`, {
        startUtc,
        overrideReason,
      });
      return parseResponse(bookingDetailSchema, res.data);
    }),

  /** 5.8: cancelling always carries a reason. */
  cancel: (id: string, reason: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/bookings/${id}/cancel`, { reason });
    }),

  /* 6.6: arrival and absence are the two reversible actions, so these are the
     only calls in the booking flow a screen may treat optimistically. */

  checkIn: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/bookings/${id}/check-in`, {});
    }),

  undoCheckIn: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/bookings/${id}/check-in/undo`, {});
    }),

  /** Never set automatically - only ever by a person (6.2). */
  noShow: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/bookings/${id}/no-show`, {});
    }),

  undoNoShow: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/bookings/${id}/no-show/undo`, {});
    }),

  /**
   * The only source of free times (6.1), and it answers for one calendar and
   * one activity - the one the patient picked. It is for the booking dialog
   * (5.9 step 3); the grid draws itself from `list` and the working hours.
   */
  getAvailability: (
    calendarId: string,
    activityId: string,
    from: DateOnly,
    to: DateOnly,
  ): Promise<AvailabilitySlot[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/availability`, {
        params: { activityId, from, to },
      });
      return parseResponse(availabilityListSchema, res.data);
    }),
};

export default bookingsApi;
