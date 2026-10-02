import client from './client';
import { toBookingError } from './apiError';
import {
  calendarAccessSchema,
  calendarListSchema,
  calendarSchema,
  parseResponse,
  type Calendar,
  type CalendarAccessEntry,
  type CalendarInput,
} from './bookingContracts';

/**
 * Calendars and who may see them - booking contract 4.1, screens 5.2 and 5.3.
 *
 * Not to be confused with the older `./calendar.ts`, which is the appointment
 * client of the system this replaces.
 */

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a response body may carry a birth number (6.7).
    throw toBookingError(error);
  }
}

export const calendarsApi = {
  /** Only the calendars the signed-in user may see. Contract 6.5: the rest do not exist. */
  list: (): Promise<Calendar[]> =>
    request(async () => {
      const res = await client.get('/api/calendars');
      return parseResponse(calendarListSchema, res.data);
    }),

  create: (input: CalendarInput): Promise<Calendar> =>
    request(async () => {
      const res = await client.post('/api/calendars', input);
      return parseResponse(calendarSchema, res.data);
    }),

  update: (id: string, input: CalendarInput): Promise<Calendar> =>
    request(async () => {
      const res = await client.put(`/api/calendars/${id}`, input);
      return parseResponse(calendarSchema, res.data);
    }),

  /*
   * Contract v37, 4.1 changes 87 and 88. `DELETE` used to deactivate; since
   * 13. 9. 2026 it deletes, and the two became different buttons because the
   * owner said they were different things: "neaktívny je keď ho zneaktívnim,
   * a nie keď ho odstránim".
   *
   * `409` is the interesting answer, not a failure: the calendar carried
   * appointments or partner orders, and the server's message says how many.
   * That message is shown as it arrives - `apiError.ts` keeps a 409's own text
   * - because "nelze smazat" without the number leaves nobody knowing what to
   * do next.
   */
  remove: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${id}`);
    }),

  /** Stops new bookings. Existing appointments stand and nobody is cancelled. */
  deactivate: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/calendars/${id}/deactivate`);
    }),

  activate: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/calendars/${id}/activate`);
    }),

  getAccess: (id: string): Promise<CalendarAccessEntry[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${id}/access`);
      return parseResponse(calendarAccessSchema, res.data);
    }),

  /** Sends only the rows the screen may actually change; locked rows are implicit. */
  setAccess: (id: string, userIds: string[]): Promise<CalendarAccessEntry[]> =>
    request(async () => {
      const res = await client.put(`/api/calendars/${id}/access`, { userIds });
      return parseResponse(calendarAccessSchema, res.data);
    }),
};

export default calendarsApi;
