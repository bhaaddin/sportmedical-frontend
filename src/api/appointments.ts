import client from './client';
import { toBookingError } from './apiError';
import {
  availabilityListSchema,
  bookedAppointmentSchema,
  dayAppointmentListSchema,
  daySummarySchema,
  historyListSchema,
  parseResponse,
  timeBlockListSchema,
  timeBlockSchema,
  type AvailabilitySlot,
  type BookedAppointment,
  type CreateAppointmentInput,
  type DayAppointment,
  type DaySummary,
  type HistoryLine,
  type TimeBlock,
} from './bookingContracts';
import { addDaysToDateOnly, type DateOnly } from '../utils/time';

/**
 * Appointments, blocks, the day and its summary - contract 4.4, 4.5 and 4.6.
 *
 * Replaces the `src/api/bookings.ts` this lane wrote earlier against
 * `/api/bookings/...`. Those paths never existed: they were a proposal in the
 * contract from before the backend was built, and the contract said so only in
 * its v13 correction. Everything here is a path the backend actually answers.
 *
 * Two rules run through the file:
 *  - 6.1, free times come from `getAvailability` and from nowhere else;
 *  - the calendar is in the path, never in the body, because access is checked
 *    on it and a calendar the user may not see answers 404, never 403 (6.5).
 */

/** 4.5: the server refuses a wider window with a 400, so say so before the trip. */
const MAX_RANGE_DAYS = 62;

function assertRangeWithinLimit(from: DateOnly, to: DateOnly): void {
  if (to < from || addDaysToDateOnly(from, MAX_RANGE_DAYS) < to) {
    throw new Error(`Rozsah smí být nejvýše ${MAX_RANGE_DAYS} dní`);
  }
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Never a fallback value: a failed call must stay visible as a failure.
    throw toBookingError(error);
  }
}

/**
 * Every date parameter is required. Sending the request without one used to
 * bind it to 1 Jan of year 1 and answer `200` with an empty list, which reads
 * exactly like a free diary; the backend now answers `400` instead. Catching it
 * here means the screen never has to tell an empty day from an unasked question.
 */
function requireDate(value: string | undefined | null, field: string): string {
  if (!value) {
    throw new Error(`Chybí povinný datum: ${field}`);
  }
  return value;
}

/**
 * The same guard for a required identifier. `availability` without
 * `activityId` used to answer a misleading 404 "činnost nenalezena" and now
 * answers 400 naming the field; either way the screen should not have sent it.
 */
function requireId(value: string | undefined | null, field: string): string {
  if (!value) {
    throw new Error(`Chybí povinný údaj: ${field}`);
  }
  return value;
}

/** Times always go out with `Z`; a time without a zone is a safety net, not a contract. */
function asUtcInstant(value: string | Date): string {
  return typeof value === 'string' ? new Date(value).toISOString() : value.toISOString();
}

export const appointmentsApi = {
  /* ── The whole visible window (4.5) ── */

  /**
   * What fills the grid: one request for the entire range and every shown
   * calendar, not one per day (7.3). A week across three calendars used to be
   * twenty-one calls, because until v15 this endpoint did not exist and the
   * contract pointed at one that never had.
   *
   * Rows arrive sorted by `startUtc` and then by calendar, so the grid does not
   * sort. Leaving `calendarIds` out means every calendar the user may see, and
   * one they may not see simply does not appear - it is not betrayed by a 404
   * either (6.5).
   */
  range: (from: DateOnly, to: DateOnly, calendarIds?: string[]): Promise<DayAppointment[]> =>
    request(async () => {
      assertRangeWithinLimit(from, to);
      const res = await client.get('/api/day', {
        params: {
          from: requireDate(from, 'from'),
          to: requireDate(to, 'to'),
          calendarIds: calendarIds && calendarIds.length > 0 ? calendarIds.join(',') : undefined,
        },
      });
      return parseResponse(dayAppointmentListSchema, res.data);
    }),

  /* ── The day of one calendar (4.5) ── */

  day: (calendarId: string, date: DateOnly): Promise<DayAppointment[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/day`, {
        params: { date: requireDate(date, 'date') },
      });
      return parseResponse(dayAppointmentListSchema, res.data);
    }),

  /* ── Booking (4.5) ── */

  /**
   * 6.3 forbids drawing the appointment before the server confirms it, so the
   * caller renders from this answer. A `409` is a normal outcome, not an error:
   * someone took the slot between the offer and the submit.
   *
   * `patientId` is required - an appointment that cannot be attributed to a real
   * patient is refused, and booking never creates one.
   */
  create: (input: CreateAppointmentInput): Promise<BookedAppointment> =>
    request(async () => {
      const res = await client.post(`/api/calendars/${input.calendarId}/appointments`, {
        ...input,
        startUtc: asUtcInstant(input.startUtc),
      });
      return parseResponse(bookedAppointmentSchema, res.data);
    }),

  /** Turns a held slot into a real appointment before the hold expires. */
  confirm: (calendarId: string, id: string): Promise<BookedAppointment> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/appointments/${id}/confirm`,
        {},
      );
      return parseResponse(bookedAppointmentSchema, res.data);
    }),

  /** A move is its own operation, not a cancel plus a new booking (4.5). */
  reschedule: (
    calendarId: string,
    id: string,
    startUtc: string | Date,
    overrideReason?: string,
  ): Promise<void> =>
    request(async () => {
      await client.put(`/api/calendars/${calendarId}/appointments/${id}/time`, null, {
        params: { startUtc: asUtcInstant(startUtc), overrideReason },
      });
    }),

  /** The reason is optional here and goes into the history. Nothing is deleted. */
  cancel: (calendarId: string, id: string, reason?: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/appointments/${id}`, {
        params: { reason },
      });
    }),

  /**
   * Arrival and absence. 6.6 makes these the two reversible actions, so a screen
   * may treat them optimistically - and 6.2 forbids setting "did not come"
   * automatically, so this is only ever called by a person pressing a button.
   */
  setStatus: (calendarId: string, id: string, status: string, reason?: string): Promise<void> =>
    request(async () => {
      await client.put(`/api/calendars/${calendarId}/appointments/${id}/status`, null, {
        params: { status, reason },
      });
    }),

  history: (calendarId: string, id: string): Promise<HistoryLine[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/appointments/${id}/history`);
      return parseResponse(historyListSchema, res.data);
    }),

  /* ── Blocked time (4.5) ── */

  blocks: (calendarId: string, from: DateOnly, to: DateOnly): Promise<TimeBlock[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/blocks`, {
        params: { from: requireDate(from, 'from'), to: requireDate(to, 'to') },
      });
      return parseResponse(timeBlockListSchema, res.data);
    }),

  createBlock: (
    calendarId: string,
    startUtc: string | Date,
    endUtc: string | Date,
    reason: string,
  ): Promise<TimeBlock> =>
    request(async () => {
      const res = await client.post(`/api/calendars/${calendarId}/blocks`, {
        startUtc: asUtcInstant(startUtc),
        endUtc: asUtcInstant(endUtc),
        reason,
      });
      return parseResponse(timeBlockSchema, res.data);
    }),

  deleteBlock: (calendarId: string, blockId: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/blocks/${blockId}`);
    }),

  /* ── The day across the clinic (4.6) ── */

  /**
   * `calendarIds` is optional; leaving it out means every calendar this user may
   * see, and only those. The day belongs to the clinic, not to one column.
   */
  daySummary: (date: DateOnly, calendarIds?: string[]): Promise<DaySummary> =>
    request(async () => {
      const res = await client.get('/api/day/summary', {
        params: {
          date: requireDate(date, 'date'),
          calendarIds: calendarIds && calendarIds.length > 0 ? calendarIds.join(',') : undefined,
        },
      });
      return parseResponse(daySummarySchema, res.data);
    }),

  /* ── Free times (4.4) ── */

  /**
   * The only source of free times (6.1), for one calendar and one activity -
   * the one the patient picked. The grid does not call this; it draws itself
   * from the day and the working hours.
   */
  getAvailability: (
    calendarId: string,
    activityId: string,
    from: DateOnly,
    to: DateOnly,
  ): Promise<AvailabilitySlot[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/availability`, {
        params: {
          activityId: requireId(activityId, 'activityId'),
          from: requireDate(from, 'from'),
          to: requireDate(to, 'to'),
        },
      });
      return parseResponse(availabilityListSchema, res.data);
    }),
};

export default appointmentsApi;
