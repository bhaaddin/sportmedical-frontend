/* ══════════════════════════════════════════════════════════════
   TRACKING — how the day is going, how the period went.

     GET /api/tracking/day?date=&calendarIds=&activityIds=&workerUserId=
         sign-in + calendar visibility, like /api/day
     GET /api/tracking/period?from=&to=&groupBy=&…
         settings.clinic.manage; at most 366 days

   Every number the server answers is counted from rows it also sends, so a
   cell on a screen can open the list it was counted from - `rowsForCell`
   below does exactly that filtering and nothing else. Nothing here derives a
   count from a name, and nothing counts anything the server did not.
   ══════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { bookingStatusSchema, parseResponse, utcInstantSchema } from './bookingContracts';
import { addDaysToDateOnly, dayOfWeekOf, type DateOnly } from '../utils/time';

/* ── Wire shapes ─────────────────────────────────────────────────── */

export const trackingCountsSchema = z.object({
  booked: z.number().int(),
  arrived: z.number().int(),
  noShow: z.number().int(),
  cancelled: z.number().int(),
  completed: z.number().int(),
  paid: z.number().int(),
  questionnaireMissing: z.number().int(),
  newPatients: z.number().int(),
  returningPatients: z.number().int(),
});
export type TrackingCounts = z.infer<typeof trackingCountsSchema>;

export const trackingRowSchema = z.object({
  appointmentId: z.string(),
  calendarId: z.string(),
  calendarName: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  activityId: z.string().nullable(),
  activityName: z.string(),
  serviceId: z.string().nullable(),
  serviceName: z.string(),
  workerUserId: z.string().nullable(),
  workerName: z.string().nullable(),
  startUtc: utcInstantSchema,
  endUtc: utcInstantSchema,
  status: bookingStatusSchema,
  isRunningLate: z.boolean(),
  checkedInUtc: utcInstantSchema.nullable(),
  paid: z.boolean(),
  /** `null` when the registry could not answer for the patient. */
  questionnaireMissing: z.boolean().nullable(),
  newPatient: z.boolean(),
});
export type TrackingRow = z.infer<typeof trackingRowSchema>;

export const trackingBreakdownSchema = z.object({
  key: z.string(),
  id: z.string().nullable(),
  name: z.string(),
  counts: trackingCountsSchema,
});
export type TrackingBreakdown = z.infer<typeof trackingBreakdownSchema>;

export const trackingPersonSchema = z.object({ userId: z.string(), displayName: z.string() });
export type TrackingPerson = z.infer<typeof trackingPersonSchema>;

export const trackingDaySchema = z.object({
  date: z.string(),
  counts: trackingCountsSchema,
  rows: z.array(trackingRowSchema),
  byService: z.array(trackingBreakdownSchema),
  byActivity: z.array(trackingBreakdownSchema),
  byWorker: z.array(trackingBreakdownSchema),
  byStatus: z.array(trackingBreakdownSchema),
  workers: z.array(trackingPersonSchema),
});
export type TrackingDay = z.infer<typeof trackingDaySchema>;

export const trackingCellSchema = z.object({
  rowId: z.string().nullable(),
  rowName: z.string(),
  columnId: z.string().nullable(),
  columnName: z.string(),
  count: z.number().int(),
});
export type TrackingCell = z.infer<typeof trackingCellSchema>;

export const trackingHeatCellSchema = z.object({
  /** 0 = Sunday, as .NET spells it on the wire. */
  dayOfWeek: z.number().int(),
  hour: z.number().int(),
  count: z.number().int(),
});
export type TrackingHeatCell = z.infer<typeof trackingHeatCellSchema>;

export const trackingPaymentsSchema = z.object({
  paidCount: z.number().int(),
  paidAmount: z.number(),
  openCount: z.number().int(),
  openAmount: z.number(),
});
export type TrackingPayments = z.infer<typeof trackingPaymentsSchema>;

export const TRACKING_GROUPINGS = ['service', 'activity', 'worker', 'day', 'status'] as const;
export type TrackingGroupBy = (typeof TRACKING_GROUPINGS)[number];

/** The server spells the enum as a number; the screen asks with a word. */
const groupBySchema = z.union([z.number().int(), z.string()]).transform((value) =>
  typeof value === 'number' ? (TRACKING_GROUPINGS[value] ?? 'service') : (value.toLowerCase() as TrackingGroupBy),
);

export const trackingPeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  groupBy: groupBySchema,
  totals: trackingCountsSchema,
  groups: z.array(trackingBreakdownSchema),
  workerByService: z.array(trackingCellSchema),
  heat: z.array(trackingHeatCellSchema),
  payments: trackingPaymentsSchema,
  diagnosticSessions: z.number().int(),
  rows: z.array(trackingRowSchema),
  workers: z.array(trackingPersonSchema),
});
export type TrackingPeriod = z.infer<typeof trackingPeriodSchema>;

/* ── The calls ───────────────────────────────────────────────────── */

export interface TrackingFilters {
  calendarIds?: string[];
  activityIds?: string[];
  workerUserId?: string | null;
}

const joined = (ids: string[] | undefined) => (ids && ids.length > 0 ? ids.join(',') : undefined);

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const trackingApi = {
  day: (date: DateOnly, filters: TrackingFilters = {}): Promise<TrackingDay> =>
    request(async () => {
      const res = await client.get('/api/tracking/day', {
        params: {
          date,
          calendarIds: joined(filters.calendarIds),
          activityIds: joined(filters.activityIds),
          workerUserId: filters.workerUserId ?? undefined,
        },
      });
      return parseResponse(trackingDaySchema, res.data);
    }),

  period: (
    from: DateOnly,
    to: DateOnly,
    groupBy: TrackingGroupBy,
    filters: TrackingFilters = {},
  ): Promise<TrackingPeriod> =>
    request(async () => {
      const res = await client.get('/api/tracking/period', {
        params: {
          from,
          to,
          groupBy,
          calendarIds: joined(filters.calendarIds),
          activityIds: joined(filters.activityIds),
          workerUserId: filters.workerUserId ?? undefined,
        },
      });
      return parseResponse(trackingPeriodSchema, res.data);
    }),
};

/* ── What each number means, in one sentence ─────────────────────── */

export type TrackingMetric = keyof TrackingCounts;

export const TRACKING_METRICS: ReadonlyArray<{ key: TrackingMetric; label: string; help: string }> = [
  { key: 'booked', label: 'Objednáno', help: 'Termíny, které nebyly zrušeny — ať už pacient přišel, nepřišel, nebo se teprve čeká.' },
  { key: 'arrived', label: 'Přišli', help: 'Pacienti, u kterých někdo kliknul „Přišel“, včetně těch, jejichž návštěva už skončila.' },
  { key: 'noShow', label: 'Nepřišli', help: 'Termíny ručně označené „Nepřišel“; nic se neoznačuje samo podle hodin.' },
  { key: 'cancelled', label: 'Zrušeno', help: 'Termíny zrušené personálem nebo pacientem přes odkaz.' },
  { key: 'completed', label: 'Dokončeno', help: 'Návštěvy označené jako hotové.' },
  { key: 'paid', label: 'Zaplaceno', help: 'Nezrušené návštěvy, ke kterým pokladna eviduje dokončenou platbu pacienta ve stejný den.' },
  { key: 'questionnaireMissing', label: 'Chybí dotazník', help: 'Nezrušené návštěvy, před kterými pacient nemá platný zdravotní dotazník; když to registr neumí říct, nepočítá se.' },
  { key: 'newPatients', label: 'Noví pacienti', help: 'Pacienti, jejichž vůbec první nezrušená návštěva spadá do vybraného období.' },
  { key: 'returningPatients', label: 'Vracející se', help: 'Pacienti v období, kteří u nás už někdy před ním byli.' },
];

export const TRACKING_EXTRA_HELP: ReadonlyArray<{ label: string; help: string }> = [
  { label: 'Podíl nepříchodů', help: 'Nepřišli děleno objednáno; kolik z objednaných termínů propadlo bez omluvy.' },
  { label: 'Vyplněné dotazníky', help: 'Objednáno minus chybí dotazník, děleno objednáno.' },
  { label: 'Pokladna', help: 'Přijato jsou dokončené platby v období; otevřené jsou platby zadané v období, které ještě nikdo nedokončil.' },
  { label: 'Diagnostická vyšetření', help: 'Diagnostická sezení s datem v období, bez ohledu na termíny v kalendáři.' },
  { label: 'Zaměstnanec', help: 'Kdo je podle pracovní doby ten den na kalendáři; bez rozpisu není přiřazen nikdo.' },
];

export const TRACKING_GROUP_LABELS: Record<TrackingGroupBy, string> = {
  service: 'Služba',
  activity: 'Činnost',
  worker: 'Zaměstnanec',
  day: 'Den',
  status: 'Stav',
};

/** The status codes with the Czech words the day screens already use. */
export const TRACKING_STATUS_LABELS: ReadonlyArray<{ code: number; label: string }> = [
  { code: 0, label: 'Objednán' },
  { code: 1, label: 'Potvrzen' },
  { code: 2, label: 'Přišel' },
  { code: 3, label: 'Hotovo' },
  { code: 4, label: 'Zrušeno' },
  { code: 5, label: 'Nepřišel' },
];

export function statusLabel(code: number): string {
  return TRACKING_STATUS_LABELS.find((s) => s.code === code)?.label ?? `Stav ${code}`;
}

/** The status the server groups under a breakdown key, back to a code. */
const STATUS_CODES: Record<string, number> = {
  Scheduled: 0,
  Confirmed: 1,
  CheckedIn: 2,
  Completed: 3,
  Cancelled: 4,
  NoShow: 5,
};

export function statusCodeOfKey(key: string): number | null {
  return key in STATUS_CODES ? STATUS_CODES[key] : null;
}

/* ── Periods ─────────────────────────────────────────────────────── */

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Dnes',
  week: 'Tento týden',
  month: 'Tento měsíc',
  custom: 'Vlastní',
};

/**
 * The range a preset means, from a given day. The week runs Monday to Sunday,
 * the month from its first to its last day; "custom" keeps what was there.
 */
export function presetRange(preset: PeriodPreset, today: DateOnly): { from: DateOnly; to: DateOnly } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week': {
      /* JS Sunday is 0; Monday is the first day of the clinic's week. */
      const back = (dayOfWeekOf(today) + 6) % 7;
      const from = addDaysToDateOnly(today, -back);
      return { from, to: addDaysToDateOnly(from, 6) };
    }
    case 'month': {
      const from = `${today.slice(0, 8)}01`;
      const [year, month] = today.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return { from, to: `${today.slice(0, 8)}${String(lastDay).padStart(2, '0')}` };
    }
    default:
      return { from: today, to: today };
  }
}

/* ── Cells and the lists behind them ─────────────────────────────── */

/** What a clicked cell asks of the rows. Every field left out means "any". */
export interface CellFilter {
  serviceId?: string | null;
  activityId?: string | null;
  workerUserId?: string | null;
  status?: number;
  /** Which counted flag the cell is: the tally column it sits in. */
  metric?: TrackingMetric;
  /** A `yyyy-MM-dd` from a day breakdown, compared on the clinic's day. */
  day?: string;
  /** From the heat map: the clinic's weekday (0 = Sunday) and hour. */
  weekdayHour?: { dayOfWeek: number; hour: number };
}

const PRAGUE = 'Europe/Prague';

/** The clinic's own weekday and hour of an instant. */
export function clinicWeekdayHour(instant: string): { dayOfWeek: number; hour: number; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PRAGUE,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hour = Number(get('hour')) % 24;
  return {
    dayOfWeek: weekdays.indexOf(get('weekday')),
    hour,
    day: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

const isLive = (row: TrackingRow) => row.status !== 4;

/** Whether one row is inside the tally the metric names — the server's own definitions, applied to its rows. */
export function rowCountsFor(row: TrackingRow, metric: TrackingMetric): boolean {
  switch (metric) {
    case 'booked':
      return isLive(row);
    case 'arrived':
      return row.status === 2 || row.status === 3;
    case 'noShow':
      return row.status === 5;
    case 'cancelled':
      return row.status === 4;
    case 'completed':
      return row.status === 3;
    case 'paid':
      return isLive(row) && row.paid;
    case 'questionnaireMissing':
      return isLive(row) && row.questionnaireMissing === true;
    case 'newPatients':
      return isLive(row) && row.newPatient;
    case 'returningPatients':
      return isLive(row) && !row.newPatient;
    default:
      return false;
  }
}

/** The rows a cell counts, in start order. Nothing is recounted: it is a filter over what the server sent. */
export function rowsForCell(rows: readonly TrackingRow[], cell: CellFilter): TrackingRow[] {
  return rows
    .filter((row) => {
      if (cell.serviceId !== undefined && (row.serviceId ?? null) !== cell.serviceId) return false;
      if (cell.activityId !== undefined && (row.activityId ?? null) !== cell.activityId) return false;
      if (cell.workerUserId !== undefined && (row.workerUserId ?? null) !== cell.workerUserId) return false;
      if (cell.status !== undefined && row.status !== cell.status) return false;
      if (cell.metric !== undefined && !rowCountsFor(row, cell.metric)) return false;
      if (cell.day !== undefined || cell.weekdayHour !== undefined) {
        const local = clinicWeekdayHour(row.startUtc);
        if (cell.day !== undefined && local.day !== cell.day) return false;
        if (
          cell.weekdayHour !== undefined &&
          (local.dayOfWeek !== cell.weekdayHour.dayOfWeek || local.hour !== cell.weekdayHour.hour)
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

/** A share as whole percent, or null when there is nothing to divide by — never "0 %" for "no data". */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function formatCzk(amount: number): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(amount);
}
