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
  /**
   * 4.1: both are optional and unset means "no limit". They only bite on public
   * booking (4.4), which is phase 2 - which is exactly why they are read and
   * carried here. Under the v27 rule a `PUT` that leaves them out **deletes**
   * them, so a screen that never showed them would still be able to throw them
   * away, and nobody would notice until phase 2 arrived and the limits were
   * gone.
   */
  publicMinimumNoticeMinutes: z.number().int().nullish().transform((v) => v ?? null),
  publicHorizonDays: z.number().int().nullish().transform((v) => v ?? null),
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
  /** Carried, not edited - see the note on `calendarSchema`. */
  publicMinimumNoticeMinutes: z.number().int().nullable(),
  publicHorizonDays: z.number().int().nullable(),
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
  /** 4.3: `DELETE` discards rather than deletes, so the row stays in the list. */
  isActive: z.boolean(),
  /**
   * 4.3 (v25): the price has one home, and it is the price list. The activity
   * only points at an item; `priceCzk` is read through that link on every
   * answer and is `null` - not zero - when there is no link. Two lists of the
   * same eight things drift apart, so there is no second list.
   */
  serviceItemId: z.string().nullish().transform((v) => v ?? null),
  priceCzk: z.number().nullish().transform((v) => v ?? null),
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
  /**
   * 4.3 (v25): `PUT` is the whole activity. Left out or sent as `null`, this
   * **clears the link to the price list** - so every screen that edits an
   * activity has to send back the one it was given, untouched, or renaming an
   * activity would quietly take its price away.
   */
  serviceItemId: z.string().nullable(),
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
    /**
     * 4.3 (v25): the four `price.*` warnings are about one activity each, so
     * the same code can arrive several times in one answer. Everything that
     * lists or dismisses a warning has to key on this too - keying on the code
     * alone would show one row and hide the rest.
     */
    activityId: z.string().nullish().transform((v) => v ?? null),
  })
  .partial()
  .passthrough();

export const activityWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: warningContextSchema.nullish().transform((v) => v ?? null),
});
export type ActivityWarning = z.infer<typeof activityWarningSchema>;

/**
 * What makes a warning one warning. The code alone does not: since v25 four of
 * them are per activity, so `price.unlinked` legitimately arrives once for
 * every activity without a price.
 */
export function warningKey(warning: ActivityWarning): string {
  return warning.context?.activityId
    ? `${warning.code}:${warning.context.activityId}`
    : warning.code;
}

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

/* ── Paperwork readiness (4.5, v29; codes v30) ── */

/**
 * Whether the patient's paperwork is in order for this appointment.
 *
 * Three things about this field are load-bearing:
 *
 *   - **`null` is not `{ ready: false }`.** Since v32 the values are live, and
 *     `null` narrowed to one case: the register does not know this patient. It
 *     is still drawn as nothing at all - no tick, no warning triangle. "Nobody
 *     could look" and "something is missing" are different claims, and a screen
 *     that conflates them tells people to chase paperwork that was handed in,
 *     or reassures them about paperwork nobody checked.
 *   - **The reasons are words.** They were going to be integers; this lane
 *     asked for strings and the booking lane agreed in v30. A number would have
 *     bought one more lookup table of the kind that has already gone missing
 *     twice here - `status` lost its table for six versions, and `status`
 *     against `action` still trips people up.
 *   - **An unknown reason is drawn as unknown**, the same tolerance the status
 *     codes get. A new code must never take the screen down.
 */
export const PAPERWORK_REASONS = [
  'questionnaire_missing',
  'questionnaire_expired',
  'report_missing',
] as const;
export type PaperworkReason = (typeof PAPERWORK_REASONS)[number];

export const paperworkSchema = z
  .object({
    ready: z.boolean(),
    missing: z.array(z.string()).nullish().transform((v) => v ?? []),
  })
  .nullish()
  .transform((v) => v ?? null);
export type Paperwork = z.infer<typeof paperworkSchema>;

/** True for a reason the contract names; anything else is shown as unknown. */
export function isKnownPaperworkReason(code: string): code is PaperworkReason {
  return (PAPERWORK_REASONS as readonly string[]).includes(code);
}

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
/**
 * 4.5 (v18): `status` travels as a number, and these are the seven the domain
 * has. The contract named them in prose until v11, then lost the table in a
 * rewrite; the names below come from the table the booking lane restored from
 * `AppointmentStatus`, not from a guess on this side.
 *
 * ⚠️ This is NOT the same numbering as `HistoryLine.action`. `3` is
 * *completed* as a status and *cancelled* as an action; `4` is *cancelled* as
 * a status and *arrived* as an action. One shared table would be silently wrong
 * half the time, so the two live apart and neither is derived from the other.
 */
export const BOOKING_STATUS_NAMES = [
  "Scheduled",
  "Confirmed",
  "CheckedIn",
  "Completed",
  "Cancelled",
  "NoShow",
  "Waitlisted",
] as const;

export type KnownBookingStatus = (typeof BOOKING_STATUS_NAMES)[number];

/** Parsed as a plain number: an unknown code must not bring the list down. */
export const bookingStatusSchema = z.number().int();

/** The name of a status code, or null when the code is one we do not know. */
export function statusName(code: number): KnownBookingStatus | null {
  return BOOKING_STATUS_NAMES[code] ?? null;
}

/** Which day-overview tally a status belongs to (4.5). `none` counts nowhere. */
export type StatusTally =
  | "booked"
  | "arrived"
  | "noShow"
  | "cancelled"
  | "none"
  | "unknown";

export function statusTally(code: number): StatusTally {
  switch (code) {
    case 0: // Scheduled
    case 1: // Confirmed
      return "booked";
    case 2: // CheckedIn
    case 3: // Completed
      return "arrived";
    case 4: // Cancelled
      return "cancelled";
    case 5: // NoShow
      return "noShow";
    case 6: // Waitlisted - this API does not produce it yet
      return "none";
    default:
      return "unknown";
  }
}

/**
 * 6.2, written as 4.5 writes it: only an appointment still expected can be
 * late. Takes the numeric code, so the old string comparison cannot come back.
 */
export function isLateStatus(code: number): boolean {
  return code === 0 || code === 1;
}

/**
 * Which status changes 4.5 allows, transcribed from the transition table the
 * booking lane restored from `AppointmentStatusRule.CanMove` - not from memory,
 * and not from what the buttons happen to be called.
 *
 * The screen asks this before it offers a button. A refused move comes back as
 * `409`, which 6.3 says to treat as an outcome rather than an error - but an
 * action that can never succeed should not be offered in the first place.
 *
 * Two entries are deliberate and easy to mistake for bugs:
 *   - `2 -> 5` exists. Marking a present patient absent is how a mis-click gets
 *     corrected, so it is allowed and merely confirmed (4.5, v23 note).
 *   - `3 -> 4` does not. A completed appointment happened; it cannot be undone.
 *     Until 9. 9. 2026 the table let it through and the entity refused, which
 *     is how the `500` this lane reported came about.
 */
export function canChangeStatus(from: number, to: number): boolean {
  // Cancelling: anything except an appointment already cancelled or completed.
  if (to === 4) return from !== 3 && from !== 4;
  switch (from) {
    case 0: // Scheduled
      return to === 1 || to === 2 || to === 5;
    case 1: // Confirmed
      return to === 2 || to === 5;
    case 2: // CheckedIn
      return to === 0 || to === 3 || to === 5;
    case 5: // NoShow
      return to === 0 || to === 2;
    default:
      // Completed, Cancelled, Waitlisted and anything unknown: nowhere but 4.
      return false;
  }
}

/**
 * A day of one calendar - 4.5 `GET /api/calendars/{id}/day`.
 *
 * `isRunningLate` arrives computed but is never stored (6.2); the screen
 * recomputes it locally with `isLate` so the number moves without a reload.
 */
export const dayAppointmentSchema = z.object({
  id: z.string(),
  /** Which column the row belongs to; present on the range answer and on /day. */
  calendarId: z.string().nullish().transform((v) => v ?? null),
  patientId: z.string(),
  activityId: z.string(),
  activityName: z.string(),
  startUtc: isoUtc,
  endUtc: isoUtc,
  status: bookingStatusSchema,
  isRunningLate: z.boolean(),
  checkedInUtc: isoUtc.nullish().transform((v) => v ?? null),
  /** 4.5, v29: the same field the detail carries, so the grid can mark it. */
  paperwork: paperworkSchema,
});
export type DayAppointment = z.infer<typeof dayAppointmentSchema>;
export const dayAppointmentListSchema = z.array(dayAppointmentSchema);

/** 4.5: who booked it, who moved it, who cancelled it and why. */
export const historyLineSchema = z.object({
  action: z.number().int(),
  actorId: z.string(),
  actorDisplayName: z.string().nullish().transform((v) => v ?? null),
  atUtc: isoUtc,
  reason: z.string().nullish().transform((v) => v ?? null),
  oldValue: z.string().nullish().transform((v) => v ?? null),
  newValue: z.string().nullish().transform((v) => v ?? null),
});
export type HistoryLine = z.infer<typeof historyLineSchema>;
export const historyListSchema = z.array(historyLineSchema);

/**
 * History actions - a **different** numbering from `status` above. Same
 * tolerance: an unknown action renders as unknown rather than dropping the row.
 */
export const HISTORY_ACTION_NAMES: Record<number, string> = {
  0: "booked",
  1: "confirmed",
  2: "rescheduled",
  3: "cancelled",
  4: "arrived",
  5: "noShow",
  6: "undone",
  7: "completed",
  8: "overridden",
};

export function historyActionName(code: number): string | null {
  return HISTORY_ACTION_NAMES[code] ?? null;
}

/** Who is booking - 4.5. */
export const BOOKING_SOURCE = { staff: 0, online: 1, partner: 2 } as const;

export const createAppointmentInputSchema = z.object({
  patientId: z.string().min(1),
  calendarId: z.string(),
  activityId: z.string(),
  startUtc: isoUtc,
  source: z.number().int().min(0).max(2),
  /** Holds the slot instead of booking it; confirmed separately, expires by itself. */
  holdMinutes: z.number().int().positive().optional(),
  /** 6.4: an override never goes out without a reason typed by a person. */
  overrideReason: z.string().trim().min(1).optional(),
  /**
   * 5.9 step 4, and 4.5 since v26. Free text; the server trims the edges and
   * truncates beyond 2 000 characters rather than refusing the booking, so a
   * long note never costs somebody their slot.
   */
  note: z.string().nullable().optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;

/**
 * `AppointmentView` - what `POST`, `/confirm`, `/time` and, since v26,
 * `GET .../appointments/{id}` all answer with. The whole shape, from the table
 * 4.5 keeps, rather than the handful of fields the first draft guessed at.
 *
 * `activityName` and `checkedInUtc` are here because this lane asked for them:
 * without the name the detail would hold a guid and have to fetch the whole
 * activity codebook for one label, and without the arrival time it could not
 * say "přišel v 9:12" about a fact the server already had. The booking lane
 * added both in v27 - and found, while doing it, that completing an appointment
 * had been wiping `checkedInUtc`.
 *
 * The patient's name is deliberately absent and will stay absent: identity
 * belongs to the register, so the detail asks for it by `patientId`.
 */
export const appointmentSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  patientId: z.string(),
  activityId: z.string(),
  /** Empty when the activity is gone, so it is never assumed to be there. */
  activityName: z.string().nullish().transform((v) => v ?? ''),
  startUtc: isoUtc,
  endUtc: isoUtc,
  status: bookingStatusSchema,
  source: z.number().int().nullish().transform((v) => v ?? null),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  heldUntilUtc: isoUtc.nullish().transform((v) => v ?? null),
  overrideReason: z.string().nullish().transform((v) => v ?? null),
  /** 5.8, v26. `null` when there is none - never an empty string. */
  note: z.string().nullish().transform((v) => v ?? null),
  checkedInUtc: isoUtc.nullish().transform((v) => v ?? null),
  /** 4.5, v29. `null` while the register cannot answer - see `paperworkSchema`. */
  paperwork: paperworkSchema,
}).passthrough();
export type Appointment = z.infer<typeof appointmentSchema>;

/** 4.5: booking answers with the appointment and any non-blocking warnings. */
export const bookedAppointmentSchema = z.object({
  appointment: appointmentSchema,
  warnings: z.array(activityWarningSchema).nullish().transform((v) => v ?? []),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;

/* ── 4.6 Day summary ── */

const namedCountSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
});

/**
 * 4.6 `GET /api/day/summary`. `freeMinutesLeft` is minutes, never places:
 * the owner decided that on 9. 9. 2026, because the same 90 minutes is two
 * slots or three depending on the activity. Do not divide it.
 */
export const daySummarySchema = z.object({
  date: dateOnly,
  booked: z.number().int(),
  arrived: z.number().int(),
  runningLate: z.number().int(),
  didNotCome: z.number().int(),
  cancelled: z.number().int(),
  byActivity: z.array(namedCountSchema).nullish().transform((v) => v ?? []),
  byCalendar: z.array(namedCountSchema).nullish().transform((v) => v ?? []),
  workingMinutes: z.number().int(),
  bookedMinutes: z.number().int(),
  unusedMinutes: z.number().int(),
  freeMinutesLeft: z.number().int(),
  /**
   * 4.6, v29: the `PODKLADY ✓ n ⚠ m` line, counted across the appointments that
   * will happen - cancelled ones do not count - with `who` already assembled,
   * so 5.12 never has to walk the day's appointments to build the list.
   */
  paperwork: z
    .object({
      ready: z.number().int(),
      missing: z.number().int(),
      who: z
        .array(
          z.object({
            appointmentId: z.string(),
            patientId: z.string(),
            calendarId: z.string(),
            activityName: z.string(),
            startUtc: isoUtc,
            missing: z.array(z.string()).nullish().transform((v) => v ?? []),
          }),
        )
        .nullish()
        .transform((v) => v ?? []),
    })
    .nullish()
    .transform((v) => v ?? null),
  nextAppointment: z
    .object({
      appointmentId: z.string(),
      calendarId: z.string(),
      calendarName: z.string(),
      activityName: z.string(),
      startUtc: isoUtc,
    })
    .nullish()
    .transform((v) => v ?? null),
});
export type DaySummary = z.infer<typeof daySummarySchema>;

/* ── 4.5 Time blocks ── */

export const timeBlockSchema = z.object({
  id: z.string(),
  startUtc: isoUtc,
  endUtc: isoUtc,
  reason: z.string().nullish().transform((v) => v ?? ''),
});
export type TimeBlock = z.infer<typeof timeBlockSchema>;
export const timeBlockListSchema = z.array(timeBlockSchema);

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
});
export type SchedulePeriodInput = z.infer<typeof schedulePeriodInputSchema>;

/**
 * Who a change of validity would strand - 4.2, v14.
 *
 * The row carries no patient: a name has no business on the working-hours
 * screen, so the API does not send one. Whoever needs to know who opens the
 * appointment where they have the right to.
 *
 * The `token` is the acknowledgement. It ages: if someone books into the
 * window between looking and saving, the save is refused and the list has to be
 * fetched again. That is the mechanism working, not a fault.
 */
export const impactedAppointmentSchema = z.object({
  appointmentId: z.string(),
  startUtc: isoUtc,
  durationMinutes: z.number().int().positive(),
});
export type ImpactedAppointment = z.infer<typeof impactedAppointmentSchema>;

export const impactReportSchema = z.object({
  periodId: z.string(),
  validFrom: dateOnly,
  validTo: dateOnly.nullish().transform((v) => v ?? null),
  appointments: z.array(impactedAppointmentSchema).nullish().transform((v) => v ?? []),
  token: z.string().nullish().transform((v) => v ?? null),
});
export type ImpactReport = z.infer<typeof impactReportSchema>;

/**
 * How the calendar turns out on a given day - 4.2 `…/preview`, after the
 * period, the cycle, an exception and a holiday have all been applied.
 *
 * This is the only source of "which dates does this row fall on". The lane used
 * to compute that locally in `utils/weekCycle.ts`; that file is gone, because a
 * second computation of the same thing is exactly what 6.1 forbids - it agreed
 * with the server right up until one of the two changed.
 */
export const previewDaySchema = z.object({
  date: dateOnly,
  isOpen: z.boolean(),
  closedBecause: z.string().nullish().transform((v) => v ?? null),
  startTime: z.string().nullish().transform((v) => v ?? null),
  endTime: z.string().nullish().transform((v) => v ?? null),
  breakStart: z.string().nullish().transform((v) => v ?? null),
  breakEnd: z.string().nullish().transform((v) => v ?? null),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  workerDisplayName: z.string().nullish().transform((v) => v ?? null),
  isChangedByOverride: z.boolean(),
  offeredActivityIds: z.array(z.string()).nullish().transform((v) => v ?? []),
});
export type PreviewDay = z.infer<typeof previewDaySchema>;
export const previewListSchema = z.array(previewDaySchema);

/**
 * The dates a week cycle falls on - 4.2 `…/periods/{pid}/cycle`.
 *
 * A different question from `preview`: this one is the raw cycle, with no
 * exception, holiday or other row applied. It answers "when does this cycle
 * land", which is what belongs under the cycle picker, and it answers it for a
 * candidate the owner has not saved yet.
 *
 * Week 0 is the week `validFrom` falls in, counted from its Monday - so "even"
 * and "odd" here are even and odd **from the start of the period**, never
 * calendar weeks of the year.
 */
export const cycleDatesSchema = z.array(dateOnly);

const timeOfDay = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'expected HH:mm' });

export const workingHourSchema = z.object({
  id: z.string(),
  schedulePeriodId: z.string().nullish().transform((v) => v ?? null),
  /** 0 = Sunday, as .NET DayOfWeek serialises it. */
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeOfDay,
  endTime: timeOfDay,
  breakStart: timeOfDay.nullish().transform((v) => v ?? null),
  breakEnd: timeOfDay.nullish().transform((v) => v ?? null),
  repeatEveryNWeeks: z.number().int().positive(),
  weekOffset: z.number().int().min(0),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  /** The name to show; the identifier alone is of no use on screen. */
  workerDisplayName: z.string().nullish().transform((v) => v ?? null),
  /**
   * The contract lists this, the API does not send it - a row existing is what
   * makes the day a working day, and removing the day removes the row. Treated
   * as true when absent rather than rejecting the whole answer, which is what
   * silently emptied this screen.
   */
  isActive: z.boolean().nullish().transform((v) => v ?? true),
});
export type WorkingHour = z.infer<typeof workingHourSchema>;
export const workingHourListSchema = z.array(workingHourSchema);

/** What the client may set. The period and the worker name belong to the server. */
export const workingHourInputSchema = workingHourSchema.omit({
  id: true,
  schedulePeriodId: true,
  workerDisplayName: true,
});
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
const dayActivityRowsSchema = z.array(dayActivityRowSchema);

/**
 * The read answers with a bare array of rows; the documented `{ rows, warnings }`
 * object is accepted too, because the contract carried both shapes at once and
 * either may turn up. Rejecting the array is what silently emptied screen 5.7.
 */
export const dayActivityGridSchema = z
  .union([
    dayActivityRowsSchema,
    z.object({
      rows: dayActivityRowsSchema.nullish().transform((v) => v ?? []),
      days: dayActivityRowsSchema.nullish().transform((v) => v ?? []),
      warnings: z.array(activityWarningSchema).nullish().transform((v) => v ?? []),
    }),
  ])
  .transform((value) =>
    Array.isArray(value)
      ? { rows: value, warnings: [] as ActivityWarning[] }
      : { rows: value.rows.length > 0 ? value.rows : value.days, warnings: value.warnings },
  );
export type DayActivityGrid = { rows: DayActivityRow[]; warnings: ActivityWarning[] };
