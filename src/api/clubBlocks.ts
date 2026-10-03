import client from './client';
import { AxiosError } from 'axios';
import { z } from 'zod';

/*
 * Club blocks - Etapa 2 contract C4 (`docs/etapa2/BRIEF.md`).
 *
 * A block holds a stretch of the calendars for one club: the chosen činnosti on
 * the chosen calendars between two dates, coloured with the club, and the
 * athletes fill it as they register through the club link. Shortening or
 * cancelling it frees the slots again.
 *
 *   POST   /api/v1/club-blocks                 create
 *   GET    /api/v1/club-blocks?from&to&clubId&status
 *   GET    /api/v1/club-blocks/{id}
 *   PUT    /api/v1/club-blocks/{id}            shorten / extend / edit
 *   DELETE /api/v1/club-blocks/{id}?cancelAthletes=true|false
 *   POST   /api/v1/club-blocks/calculate       the calculator
 *
 * Every answer is read leniently (`toBlock`, `toCalculation`): the screens
 * must not white-screen over a field the server adds or leaves out, and a
 * number that is missing is "unknown", never zero.
 *
 * Why not `toBookingError`: a 409 here carries the list of athletes the change
 * would hit, and the shared mapper keeps only the message. `ClubBlockError`
 * keeps the body's useful parts - the message, the field sentences and the
 * affected athletes - and nothing else (a body may carry personal data; it is
 * never logged).
 */

export type ClubBlockStatus = 'Active' | 'Cancelled';

export const ATHLETE_STATUSES = ['Booked', 'Attended', 'NoShow', 'Cancelled'] as const;
export type ClubBlockAthleteStatus = (typeof ATHLETE_STATUSES)[number];

/**
 * One athlete registered through the block's link (contract C-C). Names are as
 * the athlete entered them; the server never sends a birth number, and neither
 * does this type carry one.
 */
export interface ClubBlockAthlete {
  id: string;
  name: string;
  activityName: string;
  startUtc: string | null;
  endUtc: string | null;
  status: ClubBlockAthleteStatus;
  phone: string | null;
  /** The činnost the athlete is booked on (Etapa 3, seats per činnost). Absent on an older server. */
  activityId?: string | null;
}

/** What goes to the server: how many places the club takes on one činnost. */
export interface ActivitySeat {
  activityId: string;
  /** A whole number from 1. */
  seats: number;
}

/** What the server answers: the seats of one činnost and how many are taken. */
export interface ActivitySeatView extends ActivitySeat {
  activityName: string;
  registered: number;
}

export interface ClubBlockView {
  id: string;
  clubId: string;
  clubName: string;
  /** Derived from the club by the server, stable per club. */
  colorHex: string | null;
  name: string | null;
  calendarIds: string[];
  activityIds: string[];
  fromDate: string;
  toDate: string;
  dailyFrom: string | null;
  dailyTo: string | null;
  playerCount: number;
  seats: number;
  registered: number;
  status: ClubBlockStatus;
  registrationToken: string | null;
  registrationUrl: string | null;
  note: string | null;
  createdAtUtc: string | null;
  /** Newest registration last. Missing in the answer = no athletes yet = []. */
  athletes: ClubBlockAthlete[];
  /** Seats per činnost; `[]` (or absent) on a server that only knows the single headcount. */
  activitySeats?: ActivitySeatView[];
}

export interface ClubBlockInput {
  clubId: string;
  name?: string | null;
  calendarIds: string[];
  /** Derived by the server from `activitySeats`; sent only by the legacy single-headcount path. */
  activityIds?: string[];
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
  /** The sum of `activitySeats`, derived by the server - not sent together with `activitySeats`. */
  playerCount?: number;
  /** Seats per činnost; the club is counted as one whole. */
  activitySeats?: ActivitySeat[];
  note?: string | null;
}

/** What `PUT` may change: shorten or extend, the headcount, the note, the daily window. */
export interface ClubBlockUpdate {
  fromDate: string;
  toDate: string;
  playerCount?: number;
  activitySeats?: ActivitySeat[];
  note?: string | null;
  dailyFrom?: string | null;
  dailyTo?: string | null;
}

export interface ClubBlockListParams {
  from?: string;
  to?: string;
  clubId?: string;
  status?: ClubBlockStatus;
}

/** One date range of the calculation; the daily window counts from `dailyFrom` to `dailyTo` only. */
export interface CalculationRange {
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
}

export interface CalculationInput {
  /** Legacy single headcount (an older server); also the sum of `activitySeats`. */
  playerCount?: number;
  activityIds?: string[];
  activitySeats?: ActivitySeat[];
  calendarIds: string[];
  fromDate?: string;
  ranges?: CalculationRange[];
}

export interface ActivityAnalysis {
  activityId: string;
  name: string;
  seats: number;
  minutesPerSeat: number;
  parallelCapacity: number;
  neededMinutes: number;
  /** How many seats of this činnost alone fit into all the chosen windows. */
  maxSeatsInWindowsAlone: number;
}

export interface RangeAnalysis {
  fromDate: string;
  toDate: string;
  dailyFrom: string | null;
  dailyTo: string | null;
  availableMinutes: number;
}

/** The club as one whole: seats per činnost against the time inside the chosen windows. */
export interface BlockAnalysis {
  totalSeats: number;
  perActivity: ActivityAnalysis[];
  totalNeededMinutes: number;
  availableMinutes: number;
  /** Negative when the need is bigger than the time available. */
  remainingMinutes: number;
  fits: boolean;
  byRange: RangeAnalysis[];
  capacityNote: string | null;
}

export interface DayOpen {
  date: string;
  openMinutes: number;
}

export interface Calculation {
  minutesPerPlayer: number;
  parallelCapacity: number;
  neededMinutes: number;
  dailyOpenMinutes: number;
  suggestedDays: number;
  suggestedFrom: string | null;
  suggestedTo: string | null;
  /** False when the need does not fit into the booking horizon. Absent means "fits". */
  fitsHorizon: boolean;
  /** The clinic's minimum (club settings), or null when none is set. */
  minimumPlayers: number | null;
  /** The server's verdict; false whenever `minimumPlayers` is null. */
  belowMinimum: boolean;
  perDay: DayOpen[];
  /** Absent/null = the server does not know the per-činnost analysis (legacy answer). */
  analysis?: BlockAnalysis | null;
}

/** An athlete a shortening or a cancellation would hit: the same shape as in the block (`affectedAthletes`). */
export type ClubBlockConflict = ClubBlockAthlete;

/* ── Reading ── */

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const dateOnly = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 10) : '');
const hhmm = (v: unknown): string | null => (typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : null);

const text = z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? v : null), z.string().nullable());

const athleteSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  activityName: text,
  startUtc: text,
  endUtc: text,
  status: z.enum(ATHLETE_STATUSES).catch('Booked'),
  phone: text,
  activityId: text,
});

/** Athletes that cannot be read (no name) are left out; a list that is not a list is empty. */
export function toAthletes(raw: unknown): ClubBlockAthlete[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index): ClubBlockAthlete[] => {
    const withId = isRecord(item) && typeof item.id !== 'string' ? { ...item, id: `athlete-${index}` } : item;
    const parsed = athleteSchema.safeParse(withId);
    if (!parsed.success) return [];
    /* `activityId` is only there when the server sent one (seats per činnost). */
    const { activityId, ...rest } = parsed.data;
    return [{ ...rest, activityName: rest.activityName ?? '', ...(activityId !== null ? { activityId } : {}) }];
  });
}

/** Seats per činnost as the server lists them; rows without an id are left out, a missing list is empty. */
export function toActivitySeats(raw: unknown): ActivitySeatView[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((r): ActivitySeatView[] => {
    const activityId = str(r.activityId);
    return activityId === null
      ? []
      : [{ activityId, activityName: str(r.activityName) ?? '', seats: num(r.seats), registered: num(r.registered) }];
  });
}

/** The server's analysis, read leniently; anything that is not an object means "no analysis". */
export function toAnalysis(raw: unknown): BlockAnalysis | null {
  if (!isRecord(raw)) return null;
  const perActivity = Array.isArray(raw.perActivity)
    ? raw.perActivity.filter(isRecord).flatMap((a): ActivityAnalysis[] => {
        const activityId = str(a.activityId);
        return activityId === null
          ? []
          : [{
              activityId,
              name: str(a.name) ?? '',
              seats: num(a.seats),
              minutesPerSeat: num(a.minutesPerSeat),
              parallelCapacity: Math.max(1, num(a.parallelCapacity, 1)),
              neededMinutes: num(a.neededMinutes),
              maxSeatsInWindowsAlone: Math.max(0, Math.floor(num(a.maxSeatsInWindowsAlone))),
            }];
      })
    : [];
  const byRange = Array.isArray(raw.byRange)
    ? raw.byRange.filter(isRecord).map((r) => ({
        fromDate: dateOnly(r.fromDate),
        toDate: dateOnly(r.toDate),
        dailyFrom: hhmm(r.dailyFrom),
        dailyTo: hhmm(r.dailyTo),
        availableMinutes: num(r.availableMinutes),
      }))
    : [];
  const availableMinutes = num(raw.availableMinutes);
  const totalNeededMinutes = num(raw.totalNeededMinutes);
  return {
    totalSeats: num(raw.totalSeats, perActivity.reduce((n, a) => n + a.seats, 0)),
    perActivity,
    totalNeededMinutes,
    availableMinutes,
    remainingMinutes: num(raw.remainingMinutes, availableMinutes - totalNeededMinutes),
    fits: typeof raw.fits === 'boolean' ? raw.fits : availableMinutes >= totalNeededMinutes,
    byRange,
    capacityNote: str(raw.capacityNote),
  };
}

export function toBlock(raw: unknown): ClubBlockView {
  const r = isRecord(raw) ? raw : {};
  const status = typeof r.status === 'string' && r.status.toLowerCase().startsWith('cancel') ? 'Cancelled' : 'Active';
  return {
    id: str(r.id) ?? '',
    clubId: str(r.clubId) ?? '',
    clubName: str(r.clubName) ?? '',
    colorHex: str(r.colorHex),
    name: str(r.name),
    calendarIds: strings(r.calendarIds),
    activityIds: strings(r.activityIds),
    fromDate: dateOnly(r.fromDate),
    toDate: dateOnly(r.toDate),
    dailyFrom: hhmm(r.dailyFrom),
    dailyTo: hhmm(r.dailyTo),
    playerCount: num(r.playerCount),
    seats: num(r.seats, num(r.playerCount)),
    registered: num(r.registered),
    status,
    registrationToken: str(r.registrationToken),
    registrationUrl: str(r.registrationUrl),
    note: str(r.note),
    createdAtUtc: str(r.createdAtUtc),
    athletes: toAthletes(r.athletes),
    activitySeats: toActivitySeats(r.activitySeats),
  };
}

const asList = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data)) {
    const inner = data.items ?? data.value ?? data.blocks;
    if (Array.isArray(inner)) return inner;
  }
  return [];
};

export function toCalculation(raw: unknown): Calculation {
  const r = isRecord(raw) ? raw : {};
  const perDay = Array.isArray(r.perDay)
    ? r.perDay
        .filter(isRecord)
        .map((d) => ({ date: dateOnly(d.date), openMinutes: num(d.openMinutes) }))
        .filter((d) => d.date !== '')
    : [];
  const minimumPlayers = typeof r.minimumPlayers === 'number' && Number.isFinite(r.minimumPlayers) ? r.minimumPlayers : null;
  return {
    minutesPerPlayer: num(r.minutesPerPlayer),
    parallelCapacity: Math.max(1, num(r.parallelCapacity, 1)),
    neededMinutes: num(r.neededMinutes),
    dailyOpenMinutes: num(r.dailyOpenMinutes),
    suggestedDays: num(r.suggestedDays),
    suggestedFrom: str(r.suggestedFrom) ? dateOnly(r.suggestedFrom) : null,
    suggestedTo: str(r.suggestedTo) ? dateOnly(r.suggestedTo) : null,
    fitsHorizon: r.fitsHorizon !== false,
    minimumPlayers,
    belowMinimum: minimumPlayers !== null && r.belowMinimum === true,
    perDay,
    analysis: toAnalysis(r.analysis),
  };
}

/* ── Errors ── */

/**
 * A refused club-block call. `conflicts` is filled by a 409 that names the
 * athletes the change would hit; `fields` by a 400's per-field sentences.
 */
export class ClubBlockError extends Error {
  readonly status: number | undefined;
  readonly conflicts: ClubBlockConflict[];
  readonly fields: Record<string, string>;

  constructor(message: string, status: number | undefined, conflicts: ClubBlockConflict[] = [], fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ClubBlockError';
    this.status = status;
    this.conflicts = conflicts;
    this.fields = fields;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

const FALLBACK_BY_STATUS: Record<number, string> = {
  400: 'Zadané údaje nejsou v pořádku.',
  403: 'K této akci nemáte oprávnění.',
  404: 'Blok už neexistuje.',
  409: 'Změna se dotkne už registrovaných sportovců.',
};

function conflictsOf(data: unknown): ClubBlockConflict[] {
  return isRecord(data) ? toAthletes(data.affectedAthletes) : [];
}

function fieldsOf(data: unknown): Record<string, string> {
  if (!isRecord(data) || !isRecord(data.errors)) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(data.errors)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') out[field] = messages[0];
  }
  return out;
}

export function toClubBlockError(error: unknown): ClubBlockError {
  if (error instanceof ClubBlockError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === undefined) return new ClubBlockError('Server neodpovídá. Zkuste to prosím znovu.', undefined);
    const data = error.response?.data;
    const message =
      isRecord(data) && typeof data.message === 'string' && data.message.trim() !== ''
        ? data.message
        : (FALLBACK_BY_STATUS[status] ?? 'Požadavek se nepodařilo dokončit.');
    return new ClubBlockError(message, status, conflictsOf(data), fieldsOf(data));
  }
  return new ClubBlockError('Požadavek se nepodařilo dokončit.', undefined);
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toClubBlockError(error);
  }
}

/* ── Calls ── */

const BASE = '/api/v1/club-blocks';

export const clubBlocksApi = {
  list: (params: ClubBlockListParams = {}): Promise<ClubBlockView[]> =>
    request(async () => {
      const res = await client.get(BASE, { params });
      return asList(res.data).map(toBlock);
    }),

  get: (id: string): Promise<ClubBlockView> =>
    request(async () => {
      const res = await client.get(`${BASE}/${id}`);
      return toBlock(res.data);
    }),

  create: (input: ClubBlockInput): Promise<ClubBlockView> =>
    request(async () => {
      const res = await client.post(BASE, input);
      return toBlock(res.data);
    }),

  /**
   * Shorten, extend or edit. A change that would hit registered athletes comes
   * back `409` with their list; sending it again with `cancelAthletes` is the
   * operator's confirmation, and those athletes' appointments are cancelled.
   * Sent both in the query and in the body, because the contract names the flag
   * only for `DELETE` and either place is then a safe reading.
   */
  update: (id: string, input: ClubBlockUpdate, options: { cancelAthletes?: boolean } = {}): Promise<ClubBlockView> =>
    request(async () => {
      const body = options.cancelAthletes ? { ...input, cancelAthletes: true } : input;
      const res = await client.put(`${BASE}/${id}`, body, {
        params: options.cancelAthletes ? { cancelAthletes: true } : undefined,
      });
      return toBlock(res.data);
    }),

  /** `409` while athletes are registered and `cancelAthletes` is not true. */
  cancel: (id: string, cancelAthletes: boolean): Promise<void> =>
    request(async () => {
      await client.delete(`${BASE}/${id}`, { params: { cancelAthletes } });
    }),

  calculate: (input: CalculationInput): Promise<Calculation> =>
    request(async () => {
      const res = await client.post(`${BASE}/calculate`, input);
      return toCalculation(res.data);
    }),
};

/* ── What the dialog's checkbox lists need from the activities ── */

/** A činnost as the block dialog lists it, with the colour the calendar draws it in. */
export interface BlockableActivity {
  id: string;
  name: string;
  durationMinutes: number;
  clinicServiceId: string | null;
  /** C1 `effectiveColorHex`; falls back to the older `color`, then to a neutral grey. */
  colorHex: string;
  parallelCapacity: number;
}

/**
 * The same `GET /api/activities` as `activitiesApi.list`, read on its own.
 * The shared reader validates with a schema that keeps only the fields it
 * knows, and `effectiveColorHex` (C1) is exactly the field this list is for.
 */
export async function fetchBlockableActivities(): Promise<BlockableActivity[]> {
  return request(async () => {
    const res = await client.get('/api/activities');
    const data = res.data;
    const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.activities) ? data.activities : [];
    return list
      .filter(isRecord)
      .filter((a) => a.isActive !== false)
      .map((a) => ({
        id: str(a.id) ?? '',
        name: str(a.name) ?? '',
        durationMinutes: num(a.durationMinutes),
        clinicServiceId: str(a.clinicServiceId),
        colorHex: str(a.effectiveColorHex) ?? str(a.colorHex) ?? str(a.color) ?? '#B3B9C0',
        parallelCapacity: Math.max(1, num(a.parallelCapacity, 1)),
      }))
      .filter((a) => a.id !== '');
  });
}

export default clubBlocksApi;
