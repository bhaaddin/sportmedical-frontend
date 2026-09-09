import client from './client';
import { toBookingError } from './apiError';
import {
  dayActivityGridSchema,
  cycleDatesSchema,
  impactReportSchema,
  parseResponse,
  previewListSchema,
  schedulePeriodListSchema,
  schedulePeriodSchema,
  scheduleExceptionListSchema,
  scheduleExceptionSchema,
  workingHourListSchema,
  workingHourSchema,
  type DayActivityGrid,
  type DayActivityRow,
  type ImpactReport,
  type PreviewDay,
  type SchedulePeriod,
  type SchedulePeriodInput,
  type ScheduleException,
  type ScheduleExceptionInput,
  type WorkingHour,
  type WorkingHourInput,
} from './bookingContracts';

/**
 * Working hours, validity periods and exceptions - contract 4.2, screens 5.4
 * and 5.5.
 *
 * Replaces `src/services/workingHoursApi.ts`, which spoke a different model:
 * a week-parity enum, no validity periods, and slot generation the contract
 * rules out entirely - free times are computed live and never generated ahead.
 */

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const workingHoursApi = {
  /* ── Validity periods ── */

  listPeriods: (calendarId: string): Promise<SchedulePeriod[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/periods`);
      return parseResponse(schedulePeriodListSchema, res.data);
    }),

  createPeriod: (calendarId: string, input: SchedulePeriodInput): Promise<SchedulePeriod> =>
    request(async () => {
      const res = await client.post(`/api/calendars/${calendarId}/periods`, input);
      return parseResponse(schedulePeriodSchema, res.data);
    }),

  /**
   * 4.2: when `impact` listed anyone, the save carries that report's token or
   * the server refuses it with `409`. The token also ages - if someone booked
   * into the window in the meantime it stops matching, and the list has to be
   * looked at again. Both are the mechanism working.
   */
  updatePeriod: (
    calendarId: string,
    periodId: string,
    input: SchedulePeriodInput,
    acknowledgedToken?: string,
  ): Promise<SchedulePeriod> =>
    request(async () => {
      const res = await client.put(
        `/api/calendars/${calendarId}/periods/${periodId}`,
        input,
        { params: acknowledgedToken ? { acknowledgedToken } : undefined },
      );
      return parseResponse(schedulePeriodSchema, res.data);
    }),

  deletePeriod: (calendarId: string, periodId: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/periods/${periodId}`);
    }),

  /**
   * Who a change of validity would strand - asked before saving, never as a
   * reaction to an error (4.2). If it lists anyone, the save has to carry the
   * token from this answer, so the list cannot be skipped silently.
   */
  periodImpact: (
    calendarId: string,
    periodId: string,
    validFrom: string,
    validTo: string | null,
  ): Promise<ImpactReport> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/periods/${periodId}/impact`, {
        params: { validFrom, validTo: validTo ?? undefined },
      });
      return parseResponse(impactReportSchema, res.data);
    }),

  /* ── Days of the week within a period ── */

  listWorkingHours: (calendarId: string, periodId: string): Promise<WorkingHour[]> =>
    request(async () => {
      const res = await client.get(
        `/api/calendars/${calendarId}/periods/${periodId}/working-hours`,
      );
      return parseResponse(workingHourListSchema, res.data);
    }),

  createWorkingHour: (
    calendarId: string,
    periodId: string,
    input: WorkingHourInput,
  ): Promise<WorkingHour> =>
    request(async () => {
      const res = await client.post(
        `/api/calendars/${calendarId}/periods/${periodId}/working-hours`,
        input,
      );
      return parseResponse(workingHourSchema, res.data);
    }),

  updateWorkingHour: (
    calendarId: string,
    id: string,
    input: WorkingHourInput,
  ): Promise<WorkingHour> =>
    request(async () => {
      // 4.2: the row is addressed on the calendar, not under the period.
      const res = await client.put(`/api/calendars/${calendarId}/working-hours/${id}`, input);
      return parseResponse(workingHourSchema, res.data);
    }),

  deleteWorkingHour: (calendarId: string, id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/working-hours/${id}`);
    }),

  /**
   * How the calendar turns out day by day (4.2) - the source for both the
   * working-hours screen and the dates shown under a week cycle. Max 400 days
   * per call, and the range is required: a missing date is a `400`, never an
   * empty list that reads like a closed clinic.
   */
  preview: (calendarId: string, from: string, to: string): Promise<PreviewDay[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/preview`, {
        params: { from, to },
      });
      return parseResponse(previewListSchema, res.data);
    }),

  /**
   * The dates a candidate cycle falls on (4.2). Pure: it stores nothing and
   * reads no saved row, so the picker can show real dates while the owner is
   * still deciding - and they come from the server's own rule rather than from
   * a second implementation of it on this side.
   */
  cycleDates: (
    calendarId: string,
    periodId: string,
    dayOfWeek: number,
    repeatEveryNWeeks: number,
    weekOffset: number,
    from: string,
    to: string,
  ): Promise<string[]> =>
    request(async () => {
      const res = await client.get(
        `/api/calendars/${calendarId}/periods/${periodId}/cycle`,
        { params: { dayOfWeek, repeatEveryNWeeks, weekOffset, from, to } },
      );
      return parseResponse(cycleDatesSchema, res.data);
    }),

  /* ── Day-activity grid (5.7) ── */

  listDayActivities: (calendarId: string, periodId: string): Promise<DayActivityGrid> =>
    request(async () => {
      const res = await client.get(
        `/api/calendars/${calendarId}/periods/${periodId}/day-activities`,
      );
      return parseResponse(dayActivityGridSchema, res.data);
    }),

  /**
   * A full replacement for the period, never a merge: a day left out of the
   * body ends up with no activities (4.2).
   */
  saveDayActivities: (
    calendarId: string,
    periodId: string,
    rows: DayActivityRow[],
  ): Promise<DayActivityGrid> =>
    request(async () => {
      // v19: the body is { days: [...] }; the older contract said a bare array.
      const res = await client.put(
        `/api/calendars/${calendarId}/periods/${periodId}/day-activities`,
        { days: rows },
      );
      return parseResponse(dayActivityGridSchema, res.data);
    }),

  /* ── Exceptions (5.5) ── */

  listExceptions: (calendarId: string): Promise<ScheduleException[]> =>
    request(async () => {
      const res = await client.get(`/api/calendars/${calendarId}/exceptions`);
      return parseResponse(scheduleExceptionListSchema, res.data);
    }),

  createException: (
    calendarId: string,
    input: ScheduleExceptionInput,
  ): Promise<ScheduleException> =>
    request(async () => {
      const res = await client.post(`/api/calendars/${calendarId}/exceptions`, input);
      return parseResponse(scheduleExceptionSchema, res.data);
    }),

  deleteException: (calendarId: string, id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/calendars/${calendarId}/exceptions/${id}`);
    }),
};

export default workingHoursApi;
