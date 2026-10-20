/* ══════════════════════════════════════════════════════════════
   HOW LONG THE SERVER LETS A SETTING'S TEXT BE

   Measured against the dev API on 20. 10. 2026 (binary search on PUT/POST, the
   last accepted length) and read from the booking lane's SchedulingConstraints.
   Past these the server answers 422 `scheduling.text.too_long`, a 400 with an
   EF exception text (`/api/services`) or a bare 500 (`/api/holidays`), so each
   screen stops the typing at the limit instead of failing after the fact.

   A limit that changes on the server is changed here, once.
   ══════════════════════════════════════════════════════════════ */

export const FIELD_LIMITS = {
  /** Calendar name (`scheduling.calendar`). */
  calendarName: 100,
  /** Calendar location. */
  calendarLocation: 200,
  /** Služba name (`/api/clinic-services`). */
  clinicServiceName: 100,
  /** Služba description. */
  clinicServiceDescription: 500,
  /** Činnost name. */
  activityName: 120,
  /** Činnost public note. */
  activityPublicNote: 500,
  /** A free "why" on a block, an absence, an exception. */
  reason: 300,
  /** Name of a clinic holiday (`PUT /api/holidays/{date}`; longer is a 500). */
  holidayName: 300,
  /** Price-list line (`/api/services`; longer is a 400 with an EF text). */
  priceItemName: 200,
  priceItemCode: 30,
  priceItemDescription: 1000,
} as const;

/**
 * The public numbers of a calendar (`publicMinimumNoticeMinutes`, …): the
 * smallest value the server takes. Empty means "not set" and is always allowed.
 * Notice may be 0; a horizon, a hold and a cancellation lead of 0 are refused
 * (as the unhelpful `scheduling.sort_order_negative`).
 */
export const PUBLIC_NUMBER_MINIMUMS = {
  publicMinimumNoticeMinutes: 0,
  publicHorizonDays: 1,
  publicHoldMinutes: 1,
  publicCancellationHours: 1,
} as const;

/** The server stores these as 32-bit integers; anything above is a 400. */
export const MAX_INT32 = 2_147_483_647;

/** Palette of service colours: the server takes 6 to 24 (`/api/v1/settings/service-colors`). */
export const MAX_PALETTE_SIZE = 24;

/** `registrationLinkValidityDays` of the club settings: 1 to 1095. */
export const MAX_REGISTRATION_LINK_DAYS = 1095;

/** The years `GET /api/holidays/{year}` answers for ("Rok musí být mezi 2000 a 2100"); anything else is a 400. */
export const HOLIDAY_YEAR_MIN = 2000;
export const HOLIDAY_YEAR_MAX = 2100;

/** A "who pays" sentence of the club settings: 500 characters (`payerTextClubInvoice`, `payerTextPerPerson`). */
export const MAX_PAYER_TEXT = 500;
