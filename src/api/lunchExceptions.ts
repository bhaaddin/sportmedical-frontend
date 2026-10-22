/*
 * Stage 2, R17 - the lunch (OBĚD) as ONE-DAY exceptions on top of the weekly rule.
 *
 * Contract (stage2-contract.md): a lunch exception replaces the weekly lunch for ONE calendar on ONE date -
 *   `moved`   the lunch keeps its length and starts at a new time that day;
 *   `removed` no lunch that day.
 * The weekly lunch itself is never touched ("never cancelling the lunch of every Thursday").
 *
 *   GET    /api/calendars/{id}/lunch-exceptions?from=&to=      any calendar viewer
 *   PUT    /api/calendars/{id}/lunch-exceptions/{date}         bookings.edit - create or replace (idempotent)
 *   DELETE /api/calendars/{id}/lunch-exceptions/{date}         bookings.edit - restore the weekly lunch (204; 404 when none)
 *   POST   /api/calendars/{id}/appointments/into-lunch         bookings.edit - the ONLY way to book into a lunch: removes that day's
 *                                                              lunch and books; rolled back when the booking is refused
 *
 * The routes exist only on a Stage 2 server. An older server answers 404 / 405 to the reads and writes: `lunchExceptionsAvailable`
 * says so once and the desk falls back to the old behaviour (the lunch band is not clickable) instead of showing a button that
 * cannot work.
 */
import { z } from 'zod';
import client from './client';
import { BookingApiError, toBookingError } from './apiError';
import { appointmentSchema, bookedAppointmentSchema, dateOnlySchema, parseResponse, type BookedAppointment } from './bookingContracts';
import type { DateOnly } from '../utils/time';

const clock = z.string().regex(/^\d{2}:\d{2}/).transform((v) => v.slice(0, 5));

export const lunchExceptionSchema = z.object({
  calendarId: z.string(),
  date: dateOnlySchema,
  kind: z.enum(['moved', 'removed']),
  originalStart: clock.nullish().transform((v) => v ?? null),
  originalEnd: clock.nullish().transform((v) => v ?? null),
  startTime: clock.nullish().transform((v) => v ?? null),
  endTime: clock.nullish().transform((v) => v ?? null),
  reason: z.string().nullish().transform((v) => v ?? null),
  createdByUserId: z.string().nullish().transform((v) => v ?? null),
  createdAtUtc: z.string().nullish().transform((v) => v ?? null),
});
export type LunchException = z.infer<typeof lunchExceptionSchema>;
const listSchema = z.array(lunchExceptionSchema);

export type LunchExceptionInput =
  | { kind: 'moved'; startTime: string; reason?: string | undefined }
  | { kind: 'removed'; reason?: string | undefined };

export interface IntoLunchInput {
  patientId?: string | undefined;
  name?: string | undefined;
  phone?: string | undefined;
  activityId: string;
  startUtc: string;
  note?: string | null | undefined;
  agreedPriceCzk?: number | null | undefined;
  overrideReason?: string | undefined;
}

/** Problem codes of the lunch endpoints (contract table). */
export const LUNCH_CODES = {
  notFound: 'lunch.not_found',
  outsideHours: 'lunch.outside_hours',
  startInvalid: 'lunch.start_invalid',
  overlapsBooking: 'lunch.overlaps_booking',
  slotOutsideLunch: 'lunch.slot_outside_lunch',
} as const;

const LUNCH_TEXT: Record<string, string> = {
  [LUNCH_CODES.notFound]: 'V tento den už žádný oběd není.',
  [LUNCH_CODES.outsideHours]: 'Oběd musí zůstat v pracovní době dne.',
  [LUNCH_CODES.startInvalid]: 'Zadejte čas začátku oběda, například 13:00.',
  [LUNCH_CODES.overlapsBooking]: 'V tomto čase už je rezervace. Přesuňte nejdřív ji, nebo zvolte jiný čas oběda.',
  [LUNCH_CODES.slotOutsideLunch]: 'Termín musí celý ležet uvnitř oběda.',
};

/** The Czech sentence for a failed lunch call: our own wording by problem code, else the server's, else a generic one. */
export function lunchErrorText(error: unknown): string {
  if (error instanceof BookingApiError) {
    if (error.code && LUNCH_TEXT[error.code]) return LUNCH_TEXT[error.code]!;
    if (error.status === 403) return 'K úpravě oběda nemáte oprávnění.';
    if (error.serverMessage) return error.serverMessage;
  }
  return 'Oběd se nepodařilo upravit. Zkuste to prosím znovu.';
}

/** The server has no lunch-exception routes (an older build): 404 / 405 on a route that cannot exist. */
export const isLunchRouteMissing = (error: unknown): boolean =>
  error instanceof BookingApiError && (error.status === 405 || (error.status === 404 && error.code === undefined));

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a response body may carry a birth number.
    throw toBookingError(error);
  }
}

export const lunchExceptionsApi = {
  list: (calendarId: string, from: DateOnly, to: DateOnly): Promise<LunchException[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/lunch-exceptions`, { params: { from, to } });
      return parseResponse(listSchema, res.data);
    }),

  set: (calendarId: string, date: DateOnly, input: LunchExceptionInput): Promise<LunchException> =>
    request(async () => {
      const res = await client.put(`/api/calendars/${calendarId}/lunch-exceptions/${date}`, input);
      return parseResponse(lunchExceptionSchema, res.data);
    }),

  /** "Vrátit": the weekly lunch stands again for that day. */
  restore: (calendarId: string, date: DateOnly): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/lunch-exceptions/${date}`);
    }),

  /** Books into the day's lunch slot; the day's lunch is removed by the same call. */
  bookIntoLunch: (calendarId: string, input: IntoLunchInput): Promise<BookedAppointment> =>
    request(async () => {
      const res = await client.post(`/api/calendars/${calendarId}/appointments/into-lunch`, input);
      /* the contract answers the usual booked-appointment body; a bare appointment is accepted too */
      const body: unknown = res.data;
      const booked = bookedAppointmentSchema.safeParse(body);
      if (booked.success) return booked.data;
      return { appointment: parseResponse(appointmentSchema, body), warnings: [] };
    }),
};

export default lunchExceptionsApi;
