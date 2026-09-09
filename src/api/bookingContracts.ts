import { z } from 'zod';

/**
 * Response shapes for the booking contract, parts 4.1 to 4.4.
 *
 * Every response is parsed, so a contract drift shows up here as one clear
 * failure instead of as `undefined` halfway down a component tree. Contract 9.7
 * also rules out `any` in new code, which parsing gives us for free.
 */

/** Contract 3.1: new endpoints answer with `ApiResult<T>`; `client.ts` unwraps it. */
export function unwrapApiResult(payload: unknown): unknown {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

/** Parses a response that the interceptor may or may not have unwrapped already. */
export function parseResponse<T>(schema: z.ZodType<T>, payload: unknown): T {
  return schema.parse(unwrapApiResult(payload));
}

const isoUtc = z
  .string()
  .refine((v) => v.endsWith('Z'), { message: 'expected an ISO 8601 instant in UTC' });

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'expected yyyy-MM-dd with no zone' });

/* ── 4.1 Calendars ── */

export const calendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  location: z.string().nullish().transform((v) => v ?? ''),
  displayStepMinutes: z.number().int().positive(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});
export type Calendar = z.infer<typeof calendarSchema>;

export const calendarListSchema = z.array(calendarSchema);

export const calendarInputSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string(),
  location: z.string().trim(),
  displayStepMinutes: z.number().int().positive(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});
export type CalendarInput = z.infer<typeof calendarInputSchema>;

/* ── 4.1 Access (screen 5.3) ── */

/**
 * Why a row cannot be unticked. Screen 5.3 has to explain this rather than hide
 * it: Owner and Administrator always have access, and a worker assigned to a day
 * of the calendar gets it automatically.
 */
export const accessLockSchema = z.enum(['role', 'assignedWorker']);
export type AccessLock = z.infer<typeof accessLockSchema>;

export const calendarAccessEntrySchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  role: z.string(),
  hasAccess: z.boolean(),
  lockedBy: accessLockSchema.nullish().transform((v) => v ?? null),
});
export type CalendarAccessEntry = z.infer<typeof calendarAccessEntrySchema>;

export const calendarAccessSchema = z.array(calendarAccessEntrySchema);

/* ── 4.3 Activities ── */

export const activitySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  durationMinutes: z.number().int().positive(),
  color: z.string(),
  publicNote: z.string().nullish().transform((v) => v ?? ''),
  isPubliclyBookable: z.boolean(),
  sortOrder: z.number().int(),
});
export type Activity = z.infer<typeof activitySchema>;


export const activityInputSchema = z.object({
  name: z.string().trim().min(1),
  /** 5.6: any length. No fixed list, no 15-minute step. */
  durationMinutes: z.number().int().positive(),
  color: z.string(),
  publicNote: z.string().trim(),
  isPubliclyBookable: z.boolean(),
  sortOrder: z.number().int(),
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

/* ── 3.1 Warnings ── */

/**
 * A warning leaves `success` true and `message` empty and rides in `warnings`
 * alone, so an empty array is the plain case and nothing has to be inferred.
 * Any endpoint that can warn returns the same shape on the read and on the
 * write, because a warning describes state rather than the course of an action.
 */

/** A day a warning points at, so the owner knows where to look. */
export const affectedDaySchema = z.object({
  periodId: z.string(),
  periodName: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
});
export type AffectedDay = z.infer<typeof affectedDaySchema>;

/**
 * The context shape is decided by the code, and 3.1 keeps the list of codes in
 * one table rather than in the prose at each endpoint. Unknown codes stay
 * readable - the message still shows - so a new code cannot break the screen.
 */
export const warningContextSchema = z
  .object({
    affectedDays: z.array(affectedDaySchema).nullish().transform((v) => v ?? []),
    dayOfWeek: z.number().int().min(0).max(6).nullish().transform((v) => v ?? null),
  })
  .partial()
  .passthrough();

export const activityWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: warningContextSchema.nullish().transform((v) => v ?? null),
});
export type ActivityWarning = z.infer<typeof activityWarningSchema>;

/** Every day a warning names, whichever of the two context shapes it uses. */
export function warningDays(warning: ActivityWarning): number[] {
  const context = warning.context;
  if (!context) return [];
  const fromList = (context.affectedDays ?? []).map((day) => day.dayOfWeek);
  const single = typeof context.dayOfWeek === 'number' ? [context.dayOfWeek] : [];
  return Array.from(new Set([...fromList, ...single]));
}

export const activitySaveResultSchema = z.object({
  activity: activitySchema,
  warnings: z.array(activityWarningSchema).nullish().transform((v) => v ?? []),
});
export type ActivitySaveResult = z.infer<typeof activitySaveResultSchema>;

/** 4.3, v6: the read is symmetric with the write and carries the same warnings. */
export const activityListResultSchema = z.object({
  activities: z.array(activitySchema).nullish().transform((v) => v ?? []),
  warnings: z.array(activityWarningSchema).nullish().transform((v) => v ?? []),
});
export type ActivityListResult = z.infer<typeof activityListResultSchema>;

/* ── 4.4 Availability ── */

/**
 * The only source of free times (6.1). Nothing in this codebase may derive a
 * free slot from working hours, activity length or existing bookings.
 */
export const availabilitySlotSchema = z.object({
  startUtc: isoUtc,
  endUtc: isoUtc,
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityListSchema = z.array(availabilitySlotSchema);

/* ── 4.5 Bookings ── */

/**
 * The seven statuses of 4.5. There is no "late" among them: 6.2 makes that a
 * display, recomputed on the client from the rule in `isLate`.
 *
 * The list is closed - a new status is a change of contract - but an unknown
 * one must not take the screen down, so the value is parsed as a plain string
 * and classified here. An unknown status renders as unknown and counts towards
 * nothing.
 */
export const KNOWN_BOOKING_STATUSES = [
  'Scheduled',
  'Confirmed',
  'CheckedIn',
  'Completed',
  'NoShow',
  'Cancelled',
  'Waitlisted',
] as const;

export type KnownBookingStatus = (typeof KNOWN_BOOKING_STATUSES)[number];
export type BookingStatus = KnownBookingStatus | (string & {});

export const bookingStatusSchema = z.string();

export function isKnownBookingStatus(status: string): status is KnownBookingStatus {
  return (KNOWN_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Which day-overview tally a status belongs to (4.5). `none` counts nowhere. */
export type StatusTally = 'booked' | 'arrived' | 'noShow' | 'cancelled' | 'none' | 'unknown';

export function statusTally(status: string): StatusTally {
  switch (status) {
    case 'Scheduled':
    case 'Confirmed':
      return 'booked';
    case 'CheckedIn':
    case 'Completed':
      return 'arrived';
    case 'NoShow':
      return 'noShow';
    case 'Cancelled':
      return 'cancelled';
    case 'Waitlisted':
      return 'none';
    default:
      return 'unknown';
  }
}

export const bookingSourceSchema = z.enum(['Staff', 'Online', 'Partner']);
export type BookingSource = z.infer<typeof bookingSourceSchema>;

export const readinessSchema = z.object({
  isReady: z.boolean(),
  missing: z.array(z.string()).nullish().transform((v) => v ?? []),
});
export type Readiness = z.infer<typeof readinessSchema>;

/**
 * What the grid draws. Names and colours ride along on purpose (4.5) - the grid
 * must not fetch them separately.
 */
export const bookingListItemSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  calendarName: z.string(),
  calendarColor: z.string(),
  activityId: z.string(),
  activityName: z.string(),
  activityColor: z.string(),
  durationMinutes: z.number().int().positive(),
  startUtc: isoUtc,
  endUtc: isoUtc,
  status: bookingStatusSchema,
  source: bookingSourceSchema,
  patientId: z.string().nullish().transform((v) => v ?? null),
  patientName: z.string(),
  phone: z.string().nullish().transform((v) => v ?? ''),
  email: z.string().nullish().transform((v) => v ?? ''),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  workerName: z.string().nullish().transform((v) => v ?? null),
  readiness: readinessSchema,
  partnerOrderId: z.string().nullish().transform((v) => v ?? null),
  partnerName: z.string().nullish().transform((v) => v ?? null),
});
export type BookingListItem = z.infer<typeof bookingListItemSchema>;

export const bookingListSchema = z.array(bookingListItemSchema);

export const bookingDetailSchema = bookingListItemSchema.extend({
  note: z.string().nullish().transform((v) => v ?? ''),
  createdAt: isoUtc,
  createdBy: z.string(),
  cancelReason: z.string().nullish().transform((v) => v ?? null),
  cancelledAt: isoUtc.nullish().transform((v) => v ?? null),
  cancelledBy: z.string().nullish().transform((v) => v ?? null),
  overrideReason: z.string().nullish().transform((v) => v ?? null),
  checkedInAt: isoUtc.nullish().transform((v) => v ?? null),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

export const createBookingInputSchema = z.object({
  calendarId: z.string(),
  activityId: z.string(),
  startUtc: isoUtc,
  patientId: z.string().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  dateOfBirth: dateOnly,
  phone: z.string().trim(),
  email: z.string().trim(),
  note: z.string().trim().optional(),
  /** 6.4: an override never goes out without a reason typed by a person. */
  overrideReason: z.string().trim().min(1).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export { dateOnly as dateOnlySchema, isoUtc as isoUtcSchema };

/* ── 4.2 Working hours, periods and exceptions ── */

export const schedulePeriodSchema = z.object({
  id: z.string(),
  name: z.string(),
  validFrom: dateOnly,
  validTo: dateOnly.nullish().transform((v) => v ?? null),
});
export type SchedulePeriod = z.infer<typeof schedulePeriodSchema>;
export const schedulePeriodListSchema = z.array(schedulePeriodSchema);

export const schedulePeriodInputSchema = z.object({
  name: z.string().trim().min(1),
  validFrom: dateOnly,
  validTo: dateOnly.nullable(),
  /** 4.2: mandatory once `impact` reports affected bookings, or the PUT is 422. */
  acknowledgedImpact: z.boolean().optional(),
});
export type SchedulePeriodInput = z.infer<typeof schedulePeriodInputSchema>;

/** Why an already booked appointment is hit by a change of validity (4.2). */
export const impactReasonSchema = z.enum([
  'OutsideNewValidity',
  'DayNoLongerWorking',
  'OutsideNewWorkingHours',
]);
export type ImpactReason = z.infer<typeof impactReasonSchema>;

export const impactReportSchema = z.object({
  affectedCount: z.number().int(),
  bookings: z
    .array(
      z.object({
        id: z.string(),
        startUtc: isoUtc,
        activityName: z.string(),
        patientName: z.string(),
        reason: impactReasonSchema,
      }),
    )
    .nullish()
    .transform((v) => v ?? []),
});
export type ImpactReport = z.infer<typeof impactReportSchema>;

const timeOfDay = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'expected HH:mm' });

export const workingHourSchema = z.object({
  id: z.string(),
  /** 0 = Sunday, as .NET DayOfWeek serialises it. */
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeOfDay,
  endTime: timeOfDay,
  breakStart: timeOfDay.nullish().transform((v) => v ?? null),
  breakEnd: timeOfDay.nullish().transform((v) => v ?? null),
  repeatEveryNWeeks: z.number().int().positive(),
  weekOffset: z.number().int().min(0),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  isActive: z.boolean(),
});
export type WorkingHour = z.infer<typeof workingHourSchema>;
export const workingHourListSchema = z.array(workingHourSchema);

export const workingHourInputSchema = workingHourSchema.omit({ id: true });
export type WorkingHourInput = z.infer<typeof workingHourInputSchema>;

export const scheduleExceptionSchema = z.object({
  id: z.string(),
  date: dateOnly,
  isClosed: z.boolean(),
  startTime: timeOfDay.nullish().transform((v) => v ?? null),
  endTime: timeOfDay.nullish().transform((v) => v ?? null),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  reason: z.string().nullish().transform((v) => v ?? ''),
});
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;
export const scheduleExceptionListSchema = z.array(scheduleExceptionSchema);

export const scheduleExceptionInputSchema = scheduleExceptionSchema.omit({ id: true });
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionInputSchema>;

/* ── 4.2 Day-activity grid (screen 5.7) ── */

/**
 * Which activity is done on which day of a period. It hangs off the period, not
 * off a working-hour row: one day can have several rows (an even-week and an
 * odd-week Monday), and the activities would have to be duplicated in each.
 */
export const dayActivityRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  activityIds: z.array(z.string()).nullish().transform((v) => v ?? []),
});
export type DayActivityRow = z.infer<typeof dayActivityRowSchema>;

/**
 * Same shape on read and on write, per the warnings rule in 3.1: a warning
 * describes the state of the grid, not the course of an action, and that state
 * is the same whether it was just written or only read. So the owner sees
 * `working_day_without_activity` when the screen opens, not only after a save.
 */
export const dayActivityGridSchema = z.object({
  rows: z.array(dayActivityRowSchema).nullish().transform((v) => v ?? []),
  warnings: z.array(activityWarningSchema).nullish().transform((v) => v ?? []),
});
export type DayActivityGrid = z.infer<typeof dayActivityGridSchema>;
